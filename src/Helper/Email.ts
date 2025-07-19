import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Email data interface
interface EmailData {
  to: string | string[];
  subject: string;
  body: string;
  isHtml?: boolean;
}

// Create transporter with configuration
const createTransporter = (config: EmailConfig) => {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
  });
};

// Default email configuration (can be overridden)
const defaultConfig: EmailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true' || false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
};

// Send email function
export const sendEmail = async (
  emailData: EmailData,
  config: EmailConfig = defaultConfig
): Promise<{ success: boolean; messageId?: string; error?: string }> => {
  try {
    // Create transporter
    const transporter = createTransporter(config);

    // Prepare email options
    const mailOptions = {
      from: config.auth.user,
      to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
      subject: emailData.subject,
      ...(emailData.isHtml 
        ? { html: emailData.body } 
        : { text: emailData.body }
      ),
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    return {
      success: true,
      messageId: info.messageId,
    };
  } catch (error) {
    console.error('Email sending failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
};

// Bulk email sending function
export const sendBulkEmails = async (
  emails: EmailData[],
  config: EmailConfig = defaultConfig
): Promise<{ success: boolean; results: Array<{ email: string; success: boolean; error?: string }> }> => {
  const results: Array<{ email: string; success: boolean; error?: string }> = [];
  
  for (const email of emails) {
    const result = await sendEmail(email, config);
    results.push({
      email: Array.isArray(email.to) ? email.to.join(', ') : email.to,
      success: result.success,
      error: result.error,
    });
  }

  const successCount = results.filter(r => r.success).length;
  
  return {
    success: successCount === emails.length,
    results,
  };
};

// Email template helper function with professional styling
export const createEmailTemplate = (
  templateName: string,
  data: Record<string, any>
): string => {
  // Base styles for consistent email appearance
  const baseStyles = `
    <style>
      body {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        line-height: 1.6;
        color: #333;
        margin: 0;
        padding: 0;
        background-color: #f4f4f4;
      }
      .container {
        max-width: 600px;
        margin: 0 auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      .header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 40px 30px;
        text-align: center;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 300;
      }
      .content {
        padding: 40px 30px;
      }
      .content h2 {
        color: #2c3e50;
        margin-bottom: 20px;
        font-size: 24px;
        font-weight: 300;
      }
      .content p {
        margin-bottom: 16px;
        font-size: 16px;
        line-height: 1.8;
      }
      .btn {
        display: inline-block;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 14px 30px;
        text-decoration: none;
        border-radius: 6px;
        font-weight: 500;
        margin: 20px 0;
        transition: transform 0.2s;
      }
      .btn:hover {
        transform: translateY(-1px);
      }
      .footer {
        background-color: #f8f9fa;
        padding: 30px;
        text-align: center;
        border-top: 1px solid #e9ecef;
      }
      .footer p {
        margin: 0;
        font-size: 14px;
        color: #6c757d;
      }
      .divider {
        height: 1px;
        background-color: #e9ecef;
        margin: 30px 0;
      }
      .highlight {
        background-color: #e3f2fd;
        padding: 20px;
        border-radius: 6px;
        border-left: 4px solid #2196f3;
        margin: 20px 0;
      }
      .social-links {
        margin-top: 20px;
      }
      .social-links a {
        display: inline-block;
        margin: 0 10px;
        color: #6c757d;
        text-decoration: none;
      }
    </style>
  `;

  const templates: Record<string, string> = {
    welcome: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to {{companyName}}</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to {{companyName}}!</h1>
          </div>
          <div class="content">
            <h2>Hello {{name}}! 👋</h2>
            <p>We're absolutely thrilled to have you join our community. Your journey with us starts now, and we couldn't be more excited to be part of it.</p>
            
            <div class="highlight">
              <p><strong>What's next?</strong></p>
              <p>• Complete your profile setup<br>
              • Explore our features and tools<br>
              • Join our community discussions</p>
            </div>
            
            <a href="{{onboardingLink}}" class="btn">Get Started</a>
            
            <div class="divider"></div>
            
            <p>If you have any questions, our support team is here to help. Just reply to this email or visit our help center.</p>
          </div>
          <div class="footer">
            <p>Best regards,<br><strong>The {{companyName}} Team</strong></p>
            <div class="social-links">
              <a href="{{socialLinks.twitter}}">Twitter</a>
              <a href="{{socialLinks.linkedin}}">LinkedIn</a>
              <a href="{{socialLinks.website}}">Website</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `,

    notification: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{title}}</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>{{title}}</h1>
          </div>
          <div class="content">
            <h2>{{subtitle}}</h2>
            <p>{{message}}</p>
            
            {{#if actionRequired}}
            <div class="highlight">
              <p><strong>Action Required:</strong></p>
              <p>{{actionMessage}}</p>
            </div>
            
            {{#if actionLink}}
            <a href="{{actionLink}}" class="btn">{{actionText}}</a>
            {{/if}}
            {{/if}}
            
            <div class="divider"></div>
            
            <p>{{additionalInfo}}</p>
          </div>
          <div class="footer">
            <p>{{signature}}</p>
            <p style="margin-top: 10px; font-size: 12px;">
              You received this notification because you're subscribed to {{companyName}} updates.
              <a href="{{unsubscribeLink}}" style="color: #6c757d;">Unsubscribe</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `,

    reset: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Request</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>Hi {{name}},</p>
            <p>We received a request to reset your password for your {{companyName}} account. If you made this request, click the button below to set a new password.</p>
            
            <a href="{{resetLink}}" class="btn">Reset Password</a>
            
            <div class="highlight">
              <p><strong>Security Notice:</strong></p>
              <p>This link will expire in {{expiryTime}} for your security. If you didn't request this reset, you can safely ignore this email.</p>
            </div>
            
            <div class="divider"></div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #6c757d; font-size: 14px;">{{resetLink}}</p>
          </div>
          <div class="footer">
            <p>Stay secure,<br><strong>The {{companyName}} Security Team</strong></p>
            <p style="margin-top: 10px; font-size: 12px; color: #6c757d;">
              If you're having trouble, contact our support team at {{supportEmail}}
            </p>
          </div>
        </div>
      </body>
      </html>
    `,

    invoice: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice {{invoiceNumber}}</title>
        ${baseStyles}
        <style>
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          .invoice-table th,
          .invoice-table td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e9ecef;
          }
          .invoice-table th {
            background-color: #f8f9fa;
            font-weight: 600;
            color: #2c3e50;
          }
          .total-row {
            font-weight: bold;
            background-color: #f8f9fa;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invoice {{invoiceNumber}}</h1>
          </div>
          <div class="content">
            <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
              <div>
                <h2>Bill To:</h2>
                <p>{{customerName}}<br>
                {{customerAddress}}<br>
                {{customerEmail}}</p>
              </div>
              <div style="text-align: right;">
                <p><strong>Invoice Date:</strong> {{invoiceDate}}<br>
                <strong>Due Date:</strong> {{dueDate}}<br>
                <strong>Amount Due:</strong> {{totalAmount}}</p>
              </div>
            </div>
            
            <table class="invoice-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {{#each items}}
                <tr>
                  <td>{{description}}</td>
                  <td>{{quantity}}</td>
                  <td>{{rate}}</td>
                  <td>{{amount}}</td>
                </tr>
                {{/each}}
                <tr class="total-row">
                  <td colspan="3">Total</td>
                  <td>{{totalAmount}}</td>
                </tr>
              </tbody>
            </table>
            
            <a href="{{paymentLink}}" class="btn">Pay Now</a>
            
            <div class="divider"></div>
            
            <p><strong>Payment Terms:</strong> {{paymentTerms}}</p>
          </div>
          <div class="footer">
            <p>Thank you for your business!<br><strong>{{companyName}}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `,

    reminder: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{{reminderType}} Reminder</title>
        ${baseStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⏰ {{reminderType}} Reminder</h1>
          </div>
          <div class="content">
            <h2>Don't forget: {{title}}</h2>
            <p>Hi {{name}},</p>
            <p>This is a friendly reminder about {{eventDescription}}.</p>
            
            <div class="highlight">
              <p><strong>Event Details:</strong></p>
              <p>📅 <strong>Date:</strong> {{eventDate}}<br>
              🕐 <strong>Time:</strong> {{eventTime}}<br>
              📍 <strong>Location:</strong> {{eventLocation}}</p>
            </div>
            
            {{#if actionRequired}}
            <a href="{{actionLink}}" class="btn">{{actionText}}</a>
            {{/if}}
            
            <div class="divider"></div>
            
            <p>{{additionalNotes}}</p>
          </div>
          <div class="footer">
            <p>Best regards,<br><strong>{{companyName}}</strong></p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  let template = templates[templateName] || `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>{{title}}</title>
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="content">
          {{content}}
        </div>
      </div>
    </body>
    </html>
  `;

  // Replace placeholders with actual data
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    template = template.replace(regex, data[key] || '');
  });

  // Handle conditional blocks (basic implementation)
  template = template.replace(/{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g, (match, condition, content) => {
    return data[condition] ? content : '';
  });

  // Handle loops (basic implementation)
  template = template.replace(/{{#each\s+(\w+)}}([\s\S]*?){{\/each}}/g, (match, arrayName, content) => {
    const array = data[arrayName];
    if (!Array.isArray(array)) return '';
    
    return array.map(item => {
      let itemContent = content;
      Object.keys(item).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        itemContent = itemContent.replace(regex, item[key]);
      });
      return itemContent;
    }).join('');
  });

  return template;
};

// Usage examples:
export const emailExamples = {
  welcome: () => createEmailTemplate('welcome', {
    name: 'John Doe',
    companyName: 'TechCorp',
    onboardingLink: 'https://app.techcorp.com/onboarding',
    socialLinks: {
      twitter: 'https://twitter.com/techcorp',
      linkedin: 'https://linkedin.com/company/techcorp',
      website: 'https://techcorp.com'
    }
  }),

  notification: () => createEmailTemplate('notification', {
    title: 'System Maintenance Notice',
    subtitle: 'Scheduled Maintenance Tonight',
    message: 'We will be performing scheduled maintenance on our systems tonight from 2:00 AM to 4:00 AM EST.',
    actionRequired: true,
    actionMessage: 'Please save your work and log out before the maintenance window.',
    actionLink: 'https://status.techcorp.com',
    actionText: 'View Status Page',
    additionalInfo: 'We apologize for any inconvenience this may cause.',
    signature: 'The TechCorp Operations Team',
    companyName: 'TechCorp',
    unsubscribeLink: 'https://techcorp.com/unsubscribe'
  }),

  reset: () => createEmailTemplate('reset', {
    name: 'John Doe',
    companyName: 'TechCorp',
    resetLink: 'https://app.techcorp.com/reset-password?token=abc123',
    expiryTime: '24 hours',
    supportEmail: 'support@techcorp.com'
  })
};

// Validate email address
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate multiple email addresses
export const validateEmails = (emails: string[]): { valid: string[]; invalid: string[] } => {
  const valid: string[] = [];
  const invalid: string[] = [];

  emails.forEach(email => {
    if (validateEmail(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  });

  return { valid, invalid };
};

export { EmailConfig, EmailData };