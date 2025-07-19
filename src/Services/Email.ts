import { sendEmail, sendBulkEmails, createEmailTemplate, validateEmail, EmailData } from '../Helper/Email';

// Email service class
export class EmailService {
  // Send welcome email
  static async sendWelcomeEmail(userEmail: string, userName: string): Promise<boolean> {
    if (!validateEmail(userEmail)) {
      throw new Error('Invalid email address');
    }

    const emailBody = createEmailTemplate('welcome', { name: userName });
    
    const emailData: EmailData = {
      to: userEmail,
      subject: 'Welcome to Our Platform!',
      body: emailBody,
      isHtml: true,
    };

    const result = await sendEmail(emailData);
    return result.success;
  }

  // Send notification email
  static async sendNotificationEmail(
    recipients: string[],
    title: string,
    message: string
  ): Promise<{ success: boolean; failedEmails: string[] }> {
    const emailBody = createEmailTemplate('notification', {
      title,
      message,
      signature: 'Best regards,<br>The Team'
    });

    const emailData: EmailData = {
      to: recipients,
      subject: title,
      body: emailBody,
      isHtml: true,
    };

    const result = await sendEmail(emailData);
    
    return {
      success: result.success,
      failedEmails: result.success ? [] : recipients,
    };
  }

  // Send password reset email
  static async VerifyEmail(
    userEmail: string,
    OTP: string,
  ): Promise<boolean> {
    if (!validateEmail(userEmail)) {
      throw new Error('Invalid email address');
    }

    const emailBody = createEmailTemplate('reset', { OTP });

    const emailData: EmailData = {
      to: userEmail,
      subject: 'Password Reset Request',
      body: emailBody,
      isHtml: true,
    };

    const result = await sendEmail(emailData);
    return result.success;
  }

  // Send custom email
  static async sendCustomEmail(
    to: string | string[],
    subject: string,
    body: string,
    isHtml: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    const emailData: EmailData = {
      to,
      subject,
      body,
      isHtml,
    };

    return await sendEmail(emailData);
  }

  // Send bulk emails with individual content
  static async sendBulkCustomEmails(
    emails: Array<{
      to: string;
      subject: string;
      body: string;
      isHtml?: boolean;
    }>
  ): Promise<{ success: boolean; results: Array<{ email: string; success: boolean; error?: string }> }> {
    const emailData: EmailData[] = emails.map(email => ({
      to: email.to,
      subject: email.subject,
      body: email.body,
      isHtml: email.isHtml || false,
    }));

    return await sendBulkEmails(emailData);
  }
}