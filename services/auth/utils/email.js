const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

exports.sendWelcomeEmail = async (toEmail, role, password) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'Zero Trust Security <zerotrustauthentication@gmail.com>',
      to: toEmail,
      subject: 'Welcome to Zero Trust Security',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #2563eb;">Welcome to Zero Trust Security!</h2>
          <p>Hello,</p>
          <p>A new account has been created for you by the Super Admin. Below are your login credentials and access details:</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p><strong>Email:</strong> ${toEmail}</p>
            <p><strong>Password:</strong> ${password}</p>
            <p><strong>Assigned Role:</strong> ${role}</p>
            <a href="https://iamprashu.in" target="_blank">Login here</a>
          </div>

          <h3 style="color: #333;">Access Policies:</h3>
          <ul>
            <li>Please log in using your credentials.</li>
            <li>You will be required to set up an Authenticator App (TOTP) upon your first login.</li>
            <li>Device fingerprinting is active. Logging in from a new device may require additional verification.</li>
          </ul>

          <p style="color: #ef4444; font-size: 0.9em;"><strong>Important:</strong> Please change your password after logging in.</p>
          
          <br/>
          <p>Regards,<br/><strong>Zero Trust Admin Team</strong></p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Welcome email sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending welcome email:', error);
    return false;
  }
};
