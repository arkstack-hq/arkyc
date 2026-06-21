const config = () => {
  return {
    verification: {
      email: {
        subject: 'Verify Your {app_name} Account',
        template: [
          'Hello <b>{name}</b>,',
          '',
          'To start using your account, please verify your email address with the following code:',
          '<h3>{code}</h3>',
          'Thank you,',
          'The {app_name} Team',
        ].join('<br />\n'),
      },
      sms: {
        template: 'Your verification code is: {code}',
      },
    },
    verification_complete: {
      email: {
        subject: 'Your {app_name} Account is Verified',
        template: [
          'Hello <b>{name}</b>,',
          '',
          'Thank you for verifying your email address. Your account is now active and ready to use. You can log in to your account and start enjoying our services.',
          '',
          'Thank you,',
          'The {app_name} Team',
        ].join('<br />\n'),
      },
      sms: {
        template: 'Your phone number has been successfully verified.',
      },
    },
    password_reset: {
      email: {
        subject: 'Reset Your {app_name} Account',
        template: [
          'Hello <b>{name}</b>,',
          '',
          'You or someone else has requested to reset the password for your {app_name} account. If you did not make this request, please ignore this email. Otherwise, you can use the following code to reset your password:',
          '<h3>{code}</h3>',
          'Or click the link below to reset your password:',
          '<a href="{reset_link}">Reset Password</a>',
          '',
          'Thank you,',
          'The {app_name} Team',
        ].join('<br />\n'),
      },
      sms: {
        template: 'Your password reset code is: {code}',
      },
    },
    two_factor: {
      sms: {
        setup: {
          template: 'Your {app_name} two-factor setup code is {code}. It expires in 10 minutes.',
        },
        login: {
          template:
            'Your {app_name} sign-in verification code is {code}. It expires in 10 minutes.',
        },
      },
    },
  }
}

export default config
