<?php
require_once __DIR__.'/helpers.php';
$method=$_SERVER['REQUEST_METHOD'];
$route=trim($_GET['route'] ?? '', '/');
$pdo=db();

try {
  if($method==='OPTIONS'){
      header('Access-Control-Allow-Headers: Content-Type, Authorization');
      header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
      exit;
  }

  if($method==='GET' && $route==='health') {
      json_response(['ok'=>true,'service'=>'Velorian Bank PHP API','transferMode'=>'simulated-external-bank']);
  }

  if($method==='POST' && $route==='register'){
    $b=request_body(); 
    $name=trim((string)($b['name']??'')); 
    $email=strtolower(trim((string)($b['email']??''))); 
    $password=(string)($b['password']??''); 
    $currency=strtoupper((string)($b['currency']??'USD'));

    if(strlen($name)<2) json_response(['error'=>'Enter your full name.'],400);
    if(!filter_var($email,FILTER_VALIDATE_EMAIL)) json_response(['error'=>'Enter a valid email address.'],400);
    if(strlen($password)<8) json_response(['error'=>'Password must contain at least 8 characters.'],400);
    if(!in_array($currency,['USD','GBP','EUR'],true)) json_response(['error'=>'Unsupported account currency.'],400);

    $st=$pdo->prepare('SELECT id FROM clients WHERE email=?');
    $st->execute([$email]);
    if($st->fetch()) json_response(['error'=>'An account already exists with this email address.'],409);

    $now=date('Y-m-d H:i:s');
    $c=[
      'id'=>id_string('CLIENT'),
      'name'=>$name,
      'email'=>$email,
      'password_hash'=>password_hash($password,PASSWORD_DEFAULT),
      'phone'=>trim((string)($b['phone']??'')),
      'country'=>trim((string)($b['country']??'')),
      'dob'=>trim((string)($b['dob']??'')),
      'address'=>trim((string)($b['address']??'')),
      'account_type'=>in_array($b['accountType']??'', ['Savings Account','Current Account','Premium Account'],true)?$b['accountType']:'Savings Account',
      'currency'=>$currency,
      'account_number'=>account_number($pdo),
      'balance'=>0,
      'status'=>'Active',
      'force_password_change'=>0,
      'created_at'=>$now,
      'updated_at'=>$now
    ];

    $st=$pdo->prepare('INSERT INTO clients (id,name,email,password_hash,phone,country,dob,address,account_type,currency,account_number,balance,status,force_password_change,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$c['id'],$c['name'],$c['email'],$c['password_hash'],$c['phone'],$c['country'],$c['dob'],$c['address'],$c['account_type'],$c['currency'],$c['account_number'],0,'Active',0,$now,$now]);
    
    audit($pdo,'Client account created',$c['name'].' • '.$c['account_number']);
    $mail=send_account_email($c);

    json_response(['message'=>'Account created successfully.','client'=>client_row($c),'emailSent'=>$mail['sent'],'emailNotice'=>$mail['sent']?'Confirmation email sent.':$mail['reason']],201);
  }

  if($method==='POST' && $route==='admin/login'){
    $b=request_body();
    $email=strtolower(trim((string)($b['email']??'')));
    $password=(string)($b['password']??'');

    if($email!==strtolower(ADMIN_EMAIL)||!password_verify($password,password_hash(ADMIN_PASSWORD,PASSWORD_DEFAULT))) {
        json_response(['error'=>'Administrator credentials could not be verified.'],401);
    }

    $token=bin2hex(random_bytes(32));
    $st=$pdo->prepare('INSERT INTO sessions(token,role,client_id,created_at,expires_at) VALUES(?,?,NULL,NOW(),DATE_ADD(NOW(),INTERVAL 12 HOUR))');
    $st->execute([$token,'admin']);

    json_response(['token'=>$token,'administrator'=>['name'=>ADMIN_NAME,'email'=>ADMIN_EMAIL]]);
  }

  if($method==='POST' && $route==='client/login'){
    $b=request_body();
    $identifier=strtolower(trim((string)($b['identifier']??'')));
    $password=(string)($b['password']??'');

    $st=$pdo->prepare('SELECT * FROM clients WHERE LOWER(email)=? OR LOWER(account_number)=? LIMIT 1');
    $st->execute([$identifier,$identifier]);
    $c=$st->fetch();

    if(!$c||!password_verify($password,$c['password_hash'])) json_response(['error'=>'The login details could not be verified.'],401);
    if($c['status']!=='Active') json_response(['error'=>'This account is '.strtolower($c['status']).'. Please contact Velorian Bank support.'],403);

    $token=bin2hex(random_bytes(32));
    $st=$pdo->prepare('INSERT INTO sessions(token,role,client_id,created_at,expires_at) VALUES(?,?,?,NOW(),DATE_ADD(NOW(),INTERVAL 12 HOUR))');
    $st->execute([$token,'client',$c['id']]);

    json_response(['token'=>$token,'client'=>client_row($c)]);
  }

  if($method==='GET' && $route==='client/me'){
    $s=require_auth('client');
    $st=$pdo->prepare('SELECT * FROM clients WHERE id=?');
    $st->execute([$s['client_id']]);
    $c=$st->fetch();
    if(!$c) json_response(['error'=>'Client account not found.'],404);

    $tx=client_tx($pdo,$c['id']);
    json_response(['client'=>client_row($c),'transactions'=>$tx]);
  }

  if($method==='GET' && $route==='client/transactions'){
    $s=require_auth('client');
    $st=$pdo->prepare('SELECT * FROM clients WHERE id=?');
    $st->execute([$s['client_id']]);
    $c=$st->fetch();
    json_response(['client'=>$c?client_row($c):null,'transactions'=>client_tx($pdo,$s['client_id'])]);
  }

  if($method==='POST' && $route==='client/transfer/request'){
    $s=require_auth('client');
    $b=request_body();
    $pdo->beginTransaction();

    $st=$pdo->prepare('SELECT * FROM clients WHERE id=? FOR UPDATE');
    $st->execute([$s['client_id']]);
    $c=$st->fetch();

    if(!$c){$pdo->rollBack();json_response(['error'=>'Client account not found.'],404);}
    if($c['status']!=='Active'){$pdo->rollBack();json_response(['error'=>'This account cannot initiate transfers.'],403);}

    $amount=round((float)($b['amount']??0),2);
    $currency=strtoupper((string)($b['currency']??$c['currency']));
    $recipient=trim((string)($b['recipientName']??''));
    $bank=trim((string)($b['bankName']??''));
    $country=trim((string)($b['country']??''));
    $recipientAccount=trim((string)($b['recipientAccount']??''));
    $iban=trim((string)($b['iban']??''));
    $swift=trim((string)($b['swift']??''));
    $desc=substr(trim((string)($b['description']??'')),0,120);

    if($amount<=0){$pdo->rollBack();json_response(['error'=>'Enter a valid transfer amount.'],400);} 
    if($amount>(float)$c['balance']){$pdo->rollBack();json_response(['error'=>'Insufficient available funds.'],400);} 
    if($currency!==$c['currency']){$pdo->rollBack();json_response(['error'=>'Transfer currency must match your account currency.'],400);} 
    if(!$recipient||!$bank||!$country||!$recipientAccount){$pdo->rollBack();json_response(['error'=>'Complete the recipient and bank details.'],400);}

    $st=$pdo->prepare("SELECT COALESCE(SUM(amount),0) FROM transfers WHERE client_id=? AND created_at>=CURDATE() AND status IN ('Processing','Completed','Pending OTP')");
    $st->execute([$c['id']]);
    $today=(float)$st->fetchColumn();

    if($today+$amount>25000){$pdo->rollBack();json_response(['error'=>'Daily transfer limit is 25,000 '.$c['currency'].'.'],400);}

    $reference='TRF-'.strtoupper(base_convert((string)time(),10,36)).'-'.strtoupper(bin2hex(random_bytes(3)));
    $now=date('Y-m-d H:i:s');

    $st=$pdo->prepare('INSERT INTO transfers(id,client_id,client_account_number,client_name,amount,currency,recipient_name,bank_name,destination_country,recipient_account,iban,swift,description,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$reference,$c['id'],$c['account_number'],$c['name'],$amount,$currency,$recipient,$bank,$country,$recipientAccount,$iban,$swift,$desc,'Pending OTP',$now]);

    $st=$pdo->prepare('INSERT INTO transactions(id,client_id,client_account_number,client_name,type,amount,currency,status,description,timestamp,reference,recipient_name,bank_name,destination_country,recipient_account,iban,swift,status_label) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$reference,$c['id'],$c['account_number'],$c['name'],'transfer_out',$amount,$currency,'Pending',$desc?:'External transfer to '.$bank,$now,$reference,$recipient,$bank,$country,$recipientAccount,$iban,$swift,'OTP verification required']);

    $otp=(string)random_int(100000,999999);
    $st=$pdo->prepare('INSERT INTO otp_challenges(reference,client_id,otp_hash,expires_at,attempts) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 5 MINUTE),0)');
    $st->execute([$reference,$c['id'],password_hash($otp,PASSWORD_DEFAULT)]);

    $pdo->commit();
    $mail=send_otp_email($c,$otp,$amount,$currency,$recipient.' • '.$bank,$reference);

    json_response(['reference'=>$reference,'status'=>'Pending OTP','expiresInSeconds'=>300,'emailSent'=>$mail['sent'],'emailNotice'=>$mail['sent']?'OTP sent to your registered email address.':$mail['reason']],201);
  }

  if($method==='POST' && $route==='client/transfer/verify'){
    $s=require_auth('client');
    $b=request_body();
    $reference=trim((string)($b['reference']??''));
    $otp=trim((string)($b['otp']??''));

    if(!preg_match('/^\d{6}$/',$otp)) json_response(['error'=>'Enter the 6-digit OTP.'],400);

    $pdo->beginTransaction();
    $st=$pdo->prepare('SELECT o.*,t.amount,t.currency,t.recipient_name,t.bank_name,t.client_account_number,t.client_name FROM otp_challenges o JOIN transfers t ON t.id=o.reference WHERE o.reference=? AND o.client_id=? FOR UPDATE');
    $st->execute([$reference,$s['client_id']]);
    $o=$st->fetch();

    if(!$o){$pdo->rollBack();json_response(['error'=>'Transfer verification request not found.'],404);}
    if(strtotime($o['expires_at'])<time()){$pdo->rollBack();json_response(['error'=>'This OTP has expired. Please start the transfer again.'],400);}
    if((int)$o['attempts']>=5){$pdo->rollBack();json_response(['error'=>'Too many incorrect OTP attempts. Please start the transfer again.'],400);}

    if(!password_verify($otp,$o['otp_hash'])){
      $st=$pdo->prepare('UPDATE otp_challenges SET attempts=attempts+1 WHERE reference=?');
      $st->execute([$reference]);
      $pdo->commit();
      json_response(['error'=>'Incorrect OTP. Please try again.'],400);
    }

    $st=$pdo->prepare('SELECT * FROM clients WHERE id=? FOR UPDATE');
    $st->execute([$s['client_id']]);
    $c=$st->fetch();

    if(!$c||$c['status']!=='Active'){$pdo->rollBack();json_response(['error'=>'This account cannot complete the transfer.'],403);}
    if((float)$c['balance']<(float)$o['amount']){$pdo->rollBack();json_response(['error'=>'Insufficient available funds.'],400);}

    $newBalance=(float)$c['balance']-(float)$o['amount'];
    $st=$pdo->prepare('UPDATE clients SET balance=?,updated_at=NOW() WHERE id=?');
    $st->execute([$newBalance,$c['id']]);

    $st=$pdo->prepare("UPDATE transfers SET status='Processing',verified_at=NOW() WHERE id=?");
    $st->execute([$reference]);

    $st=$pdo->prepare("UPDATE transactions SET status='Success',status_label='OTP verified and transfer is processing' WHERE id=?");
    $st->execute([$reference]);

    $pdo->commit();
    audit($pdo,'External transfer verified',$c['name'].' • '.$reference.' • '.number_format((float)$o['amount'],2).' '.$o['currency']);

    json_response(['reference'=>$reference,'status'=>'Processing','balance'=>$newBalance]);
  }

  if($method==='GET' && $route==='admin/clients'){
    require_auth('admin');
    $rows=$pdo->query('SELECT * FROM clients ORDER BY created_at DESC')->fetchAll();
    json_response(['clients'=>array_map('client_row',$rows)]);
  }

  if($method==='GET' && $route==='admin/transfers'){
    require_auth('admin');
    $rows=$pdo->query('SELECT t.*,c.email FROM transfers t LEFT JOIN clients c ON c.id=t.client_id ORDER BY t.created_at DESC')->fetchAll();
    json_response(['transfers'=>$rows,'transactions'=>admin_tx($pdo)]);
  }

  if($method==='POST' && $route==='admin/client/create'){
    require_auth('admin');
    $b=request_body();
    $name=trim((string)($b['name']??''));
    $email=strtolower(trim((string)($b['email']??'')));
    $password=(string)($b['password']??'');
    $currency=strtoupper((string)($b['currency']??'USD'));
    $balance=round((float)($b['initialBalance']??0),2);

    if(strlen($name)<2||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($password)<8||$balance<0||!in_array($currency,['USD','GBP','EUR'],true)){
      json_response(['error'=>'Complete the client details correctly.'],400);
    }

    $st=$pdo->prepare('SELECT id FROM clients WHERE email=?');
    $st->execute([$email]);
    if($st->fetch()) json_response(['error'=>'A client with this email already exists.'],409);

    $now=date('Y-m-d H:i:s');
    $c=[
      'id'=>id_string('CLIENT'),
      'name'=>$name,
      'email'=>$email,
      'password_hash'=>password_hash($password,PASSWORD_DEFAULT),
      'phone'=>trim((string)($b['phone']??'')),
      'country'=>'',
      'dob'=>trim((string)($b['dob']??'')),
      'address'=>trim((string)($b['address']??'')),
      'account_type'=>$b['accountType']??'Savings Account',
      'currency'=>$currency,
      'account_number'=>account_number($pdo),
      'balance'=>$balance,
      'status'=>'Active',
      'force_password_change'=>0,
      'created_at'=>$now,
      'updated_at'=>$now
    ];

    $st=$pdo->prepare('INSERT INTO clients (id,name,email,password_hash,phone,country,dob,address,account_type,currency,account_number,balance,status,force_password_change,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$c['id'],$c['name'],$c['email'],$c['password_hash'],$c['phone'],$c['country'],$c['dob'],$c['address'],$c['account_type'],$c['currency'],$c['account_number'],$balance,'Active',0,$now,$now]);

    if ($balance > 0) {
    insert_tx(
        $pdo,
        $c,
        'deposit',
        $balance,
        $currency,
        'Success',
        'Opening balance'
    );
}

audit(
    $pdo,
    'Client account created',
    $c['name'] . ' • ' . $c['account_number']
);

/*
 * Send the client's account-number notification
 * after the account has been successfully created.
 */
$mail = send_account_email($c);

json_response(
    [
        'message' => 'Client account created successfully.',
        'client' => client_row($c),
        'emailSent' => $mail['sent'],
        'emailNotice' => $mail['sent']
            ? 'Account confirmation email sent to the client.'
            : 'Account created, but the confirmation email could not be sent: ' . $mail['reason']
    ],
    201
);
  }

  if($method==='POST' && $route==='admin/client/update'){
    require_auth('admin');
    $b=request_body();
    $id=(string)($b['id']??'');

    $st=$pdo->prepare('SELECT * FROM clients WHERE id=?');
    $st->execute([$id]);
    $c=$st->fetch();

    if(!$c) json_response(['error'=>'Client account not found.'],404);

    $email=strtolower(trim((string)($b['email']??$c['email'])));
    $currency=strtoupper((string)($b['currency']??$c['currency']));

    if($email!==strtolower($c['email'])){
      $st=$pdo->prepare('SELECT id FROM clients WHERE email=? AND id<>?');
      $st->execute([$email,$id]);
      if($st->fetch()) json_response(['error'=>'Another client already uses this email.'],409);
    }

    if($currency!==$c['currency']){
      $st=$pdo->prepare('SELECT COUNT(*) FROM transactions WHERE client_id=?');
      $st->execute([$id]);
      if((int)$st->fetchColumn()>0||(float)$c['balance']!=0) json_response(['error'=>'Account currency cannot be changed after a balance or transaction history exists.'],400);
    }

    if(!in_array($currency,['USD','GBP','EUR'],true)) json_response(['error'=>'Unsupported account currency.'],400);

    $st=$pdo->prepare('UPDATE clients SET name=?,email=?,phone=?,dob=?,address=?,account_type=?,currency=?,status=?,updated_at=NOW() WHERE id=?');
    $st->execute([trim((string)($b['name']??$c['name'])),$email,trim((string)($b['phone']??$c['phone'])),trim((string)($b['dob']??$c['dob'])),trim((string)($b['address']??$c['address'])),(string)($b['accountType']??$c['account_type']),$currency,(string)($b['status']??$c['status']),$id]);

    $st=$pdo->prepare('SELECT * FROM clients WHERE id=?');
    $st->execute([$id]);
    $new=$st->fetch();

    audit($pdo,'Client profile updated',$new['name'].' • '.$new['account_number'].' • '.$new['currency']);
    json_response(['client'=>client_row($new)]);
  }

  if ($method === 'POST' && $route === 'admin/client/delete') {

    /*
     * ADMIN AUTHORIZATION
     */
    require_auth('admin');

    $b = request_body();

    /*
     * Accept either:
     *
     * - internal client ID
     * - 10-digit account number
     */
    $identifier = trim((string)($b['id'] ?? ''));

    if ($identifier === '') {
        $identifier = trim((string)($b['clientId'] ?? ''));
    }

    if ($identifier === '') {
        $identifier = trim((string)($b['accountNumber'] ?? ''));
    }

    if ($identifier === '') {
        json_response([
            'error' => 'Client identifier is required.'
        ], 400);
    }

    /*
     * Find client by either internal ID OR account number.
     */
    $st = $pdo->prepare(
        'SELECT * FROM clients
         WHERE id = ?
            OR account_number = ?
         LIMIT 1'
    );

    $st->execute([
        $identifier,
        $identifier
    ]);

    $c = $st->fetch();

    if (!$c) {
        json_response([
            'error' => 'Client account not found.'
        ], 404);
    }

    $clientId = $c['id'];

    try {

        $pdo->beginTransaction();

        /*
         * Delete dependent records first.
         */
        foreach (
            [
                'otp_challenges',
                'transfers',
                'transactions',
                'sessions'
            ] as $table
        ) {

            $st = $pdo->prepare(
                "DELETE FROM {$table} WHERE client_id = ?"
            );

            $st->execute([
                $clientId
            ]);
        }

        /*
         * Finally delete the client.
         */
        $st = $pdo->prepare(
            'DELETE FROM clients WHERE id = ?'
        );

        $st->execute([
            $clientId
        ]);

        if ($st->rowCount() !== 1) {

            $pdo->rollBack();

            json_response([
                'error' => 'The client account could not be deleted.'
            ], 500);
        }

        $pdo->commit();

    } catch (Throwable $e) {

        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        json_response([
            'error' => 'Unable to delete the client account.'
        ], 500);
    }

    /*
     * Keep an audit record after successful deletion.
     */
    audit(
        $pdo,
        'Client account deleted',
        $c['name'] . ' • ' . $c['account_number']
    );

    json_response([
        'message' => 'Client account deleted successfully.',
        'deleted' => client_row($c)
    ]);
}

  // Route: Admin Transaction (Deposit / Withdrawal)
  if($method==='POST' && $route==='admin/transaction'){
    require_auth('admin');
    $b=request_body();
    
    // Support all common frontend key variants
    $id=(string)($b['clientId'] ?? $b['client_id'] ?? $b['account_id'] ?? '');
    $type=strtolower((string)($b['type']??'deposit'));
    $status='Success'; // Force status to Success instantly
    $amount=round((float)($b['amount']??0),2);
    $desc=substr(trim((string)($b['description']??'')),0,120);

    // Fetch client by ID or Account Number
    $st=$pdo->prepare('SELECT * FROM clients WHERE id=? OR account_number=? FOR UPDATE');
    $st->execute([$id, $id]);
    $c=$st->fetch();

    if(!$c) json_response(['error'=>'Client account not found.'],404);
    if(!in_array($type,['deposit','withdrawal'],true)) json_response(['error'=>'Unsupported transaction type.'],400);
    if($amount<=0) json_response(['error'=>'Enter a valid amount.'],400);
    if($c['status']!=='Active') json_response(['error'=>'This account is restricted.'],400);
    if($type==='withdrawal' && $amount>(float)$c['balance']) json_response(['error'=>'Insufficient funds.'],400);

    $pdo->beginTransaction();
    
    // Update account balance
    $new=(float)$c['balance']+($type==='deposit'?$amount:-$amount);
    $st=$pdo->prepare('UPDATE clients SET balance=?,updated_at=NOW() WHERE id=?');
    $st->execute([$new, $c['id']]);

    // Record into transaction table
    $tx=insert_tx($pdo, $c, $type, $amount, $c['currency'], $status, $desc ?: ucfirst($type));
    
    $pdo->commit();
    audit($pdo, ucfirst($type).' posted', $c['name'].' • '.number_format($amount,2).' '.$c['currency']);

    json_response(['transaction'=>$tx, 'new_balance'=>$new]);
  }

  if($method==='POST' && $route==='admin/internal-transfer'){
    require_auth('admin');
    $b=request_body();
    $senderId=(string)($b['senderId']??'');
    $recipientAccount=trim((string)($b['recipientAccount']??''));
    $amount=round((float)($b['amount']??0),2);
    $desc=substr(trim((string)($b['description']??'')),0,120);

    $pdo->beginTransaction();

    $st=$pdo->prepare('SELECT * FROM clients WHERE id=? OR account_number=? FOR UPDATE');
    $st->execute([$senderId, $senderId]);
    $sender=$st->fetch();

    $st=$pdo->prepare('SELECT * FROM clients WHERE account_number=? OR id=? FOR UPDATE');
    $st->execute([$recipientAccount, $recipientAccount]);
    $rec=$st->fetch();

    if(!$sender||!$rec||$sender['id']===$rec['id']){
      $pdo->rollBack();
      json_response(['error'=>'Valid sender and recipient accounts are required.'],400);
    }

    if($amount<=0||$amount>(float)$sender['balance']){
      $pdo->rollBack();
      json_response(['error'=>'Invalid amount or insufficient funds.'],400);
    }

    if($sender['status']!=='Active'||$rec['status']!=='Active'){
      $pdo->rollBack();
      json_response(['error'=>'Both accounts must be active.'],400);
    }

    $rates=currencies();
    $rate=$rates[$sender['currency']][$rec['currency']]??1.0;
    $received=round($amount*$rate,2);

    $new=(float)$sender['balance']-$amount;
    $st=$pdo->prepare('UPDATE clients SET balance=?,updated_at=NOW() WHERE id=?');
    $st->execute([$new,$sender['id']]);

    $new2=(float)$rec['balance']+$received;
    $st=$pdo->prepare('UPDATE clients SET balance=?,updated_at=NOW() WHERE id=?');
    $st->execute([$new2,$rec['id']]);

    $ref='TRF-'.strtoupper(bin2hex(random_bytes(6)));
    $now=date('Y-m-d H:i:s');

    $st=$pdo->prepare('INSERT INTO transactions(id,client_id,client_account_number,client_name,type,amount,currency,status,description,timestamp,reference,received_amount,received_currency,exchange_rate,related_client_id,related_account_number,direction) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$ref,$sender['id'],$sender['account_number'],$sender['name'],'transfer_out',$amount,$sender['currency'],'Success',$desc?:'Internal transfer',$now,$ref,$received,$rec['currency'],$rate,$rec['id'],$rec['account_number'],'out']);

    $st=$pdo->prepare('INSERT INTO transactions(id,client_id,client_account_number,client_name,type,amount,currency,status,description,timestamp,reference,received_amount,received_currency,exchange_rate,related_client_id,related_account_number,direction) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $st->execute([$ref.'-IN',$rec['id'],$rec['account_number'],$rec['name'],'transfer_in',$received,$rec['currency'],'Success',$desc?:'Internal transfer',$now,$ref,$amount,$sender['currency'],$rate,$sender['id'],$sender['account_number'],'in']);

    $pdo->commit();
    audit($pdo,'Internal transfer posted',$sender['name'].' → '.$rec['name'].' • '.$ref);

    json_response(['reference'=>$ref]);
  }

  if($method==='POST' && $route==='admin/client/password'){
    require_auth('admin');
    $b=request_body();
    $id=(string)($b['clientId']??'');
    $pw=(string)($b['password']??'');

    if(strlen($pw)<8) json_response(['error'=>'Password must contain at least 8 characters.'],400);

    $st=$pdo->prepare('UPDATE clients SET password_hash=?,force_password_change=1,updated_at=NOW() WHERE id=?');
    $st->execute([password_hash($pw,PASSWORD_DEFAULT),$id]);

    audit($pdo,'Client password reset','Client '.$id);
    json_response(['ok'=>true]);
  }

  if($method==='POST' && $route==='client/password'){
    $s=require_auth('client');
    $b=request_body();
    $pw=(string)($b['password']??'');

    if(strlen($pw)<8) json_response(['error'=>'Password must contain at least 8 characters.'],400);

    $st=$pdo->prepare('UPDATE clients SET password_hash=?,force_password_change=0,updated_at=NOW() WHERE id=?');
    $st->execute([password_hash($pw,PASSWORD_DEFAULT),$s['client_id']]);

    json_response(['ok'=>true]);
  }

  if($method==='POST' && $route==='admin/settings'){
    require_auth('admin');
    $b=request_body();

    foreach(['defaultCurrency','USDGBP','USDEUR','GBPUSD','GBPEUR','EURUSD','EURGBP'] as $k){
      if(isset($b[$k])){
        $st=$pdo->prepare('INSERT INTO settings(setting_key,setting_value) VALUES(?,?) ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)');
        $st->execute([$k,(string)$b[$k]]);
      }
    }
    json_response(['ok'=>true]);
  }

  if ($method === 'POST' && $route === 'admin/reset') {

    require_auth('admin');

    $pdo->beginTransaction();

    foreach (
        [
            'otp_challenges',
            'transfers',
            'transactions',
            'sessions',
            'audit_logs',
            'clients'
        ] as $t
    ) {
        $pdo->exec('DELETE FROM ' . $t);
    }

    $pdo->commit();

    json_response([
        'ok' => true,
        'message' => 'Bank data reset successfully.'
    ]);
}

  json_response(['error'=>'API route not found.'],404);

} catch(Throwable $e){
  if($pdo->inTransaction()) $pdo->rollBack();
  json_response(['error'=>'Server error. Check the PHP/MySQL configuration and server logs.'],500);
}

function client_tx(PDO $pdo,string $id): array {
  $st=$pdo->prepare('SELECT * FROM transactions WHERE client_id=? ORDER BY timestamp DESC');
  $st->execute([$id]);
  return array_map('transaction_row',$st->fetchAll());
}

function admin_tx(PDO $pdo): array {
  $st=$pdo->query('SELECT * FROM transactions ORDER BY timestamp DESC');
  return array_map('transaction_row',$st->fetchAll());
}

function insert_tx(PDO $pdo,array $c,string $type,float $amount,string $currency,string $status,string $desc): array {
  $id=id_string('TX');
  $now=date('Y-m-d H:i:s');
  $st=$pdo->prepare('INSERT INTO transactions(id,client_id,client_account_number,client_name,type,amount,currency,status,description,timestamp,reference) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  $st->execute([$id,$c['id'],$c['account_number'],$c['name'],$type,$amount,$currency,$status,$desc,$now,$id]);
  $t=['id'=>$id,'client_id'=>$c['id'],'client_account_number'=>$c['account_number'],'client_name'=>$c['name'],'type'=>$type,'amount'=>$amount,'currency'=>$currency,'status'=>$status,'description'=>$desc,'timestamp'=>$now,'reference'=>$id];
  return transaction_row($t);
}