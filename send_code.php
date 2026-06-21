<?php
require_once __DIR__ . '/PHPMailer/src/PHPMailer.php';
require_once __DIR__ . '/PHPMailer/src/SMTP.php';
require_once __DIR__ . '/PHPMailer/src/Exception.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

$email = $argv[1] ?? '';
$code = $argv[2] ?? '';
$nombre = $argv[3] ?? '';
$type = $argv[4] ?? 'verify'; // verify or reset

if (!$email || !$code) { echo "ERROR: Missing args"; exit(1); }

try {
    $mail = new PHPMailer(true);
    $mail->isSMTP();
    $mail->Host       = 'smtp.gmail.com';
    $mail->SMTPAuth   = true;
    $mail->Username   = 'maykelmillan96@gmail.com';
    $mail->Password   = 'jjgv kitl piua itox';
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->setFrom('maykelmillan96@gmail.com', 'Gestion Cuba');
    $mail->addAddress($email, $nombre);

    if ($type === 'reset') {
        $mail->Subject = 'Recuperacion de contrasena - Gestion Cuba';
        $mail->Body    = "<p>Hola <strong>$nombre</strong>,</p><p>Recibimos una solicitud para restablecer tu contrasena en <strong>Gestion Cuba</strong>.</p><p>Tu codigo de verificacion es:</p><h2 style=\"font-size:2rem;letter-spacing:6px;color:#2e7d32\">$code</h2><p>Ingresa este codigo en la aplicacion para crear una nueva contrasena.</p><p>Si no solicitaste esto, ignora este mensaje.</p>";
        $mail->AltBody = "Hola $nombre, tu codigo de verificacion es: $code";
    } else {
        $mail->Subject = 'Verifica tu correo - Gestion Cuba';
        $mail->Body    = "<p>Hola <strong>$nombre</strong>,</p><p>Gracias por registrarte en <strong>Gestion Cuba</strong>.</p><p>Tu codigo de verificacion es:</p><h2 style=\"font-size:2rem;letter-spacing:6px;color:#2e7d32\">$code</h2><p>Ingresa este codigo en la aplicacion para completar tu registro.</p><p>Si no solicitaste este registro, ignora este mensaje.</p>";
        $mail->AltBody = "Hola $nombre, tu codigo de verificacion es: $code";
    }
    $mail->send();
    echo "OK";
} catch (Exception $e) {
    echo "ERROR: " . $mail->ErrorInfo;
    exit(1);
}
