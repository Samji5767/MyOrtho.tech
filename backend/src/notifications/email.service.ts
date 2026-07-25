import { Injectable, Logger } from '@nestjs/common';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly configured: boolean;
  private readonly fromAddress: string;

  constructor() {
    this.configured = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
    this.fromAddress = process.env.SMTP_FROM ?? 'noreply@myortho.tech';
  }

  async send(opts: EmailOptions): Promise<void> {
    if (!this.configured) {
      this.logger.warn(
        `[EmailService] SMTP not configured — email to ${opts.to} suppressed. ` +
        `Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM to enable delivery.`,
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodemailer: any = await import('nodemailer').catch(() => null);
    if (!nodemailer) {
      const msg = '[EmailService] nodemailer package not found. Run: npm install nodemailer';
      this.logger.error(msg);
      throw new Error(msg);
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT ?? '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    // Throws on delivery failure — callers that need fire-and-forget must .catch()
    await transporter.sendMail({
      from: this.fromAddress,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    });
    this.logger.log(`[EmailService] Email sent to ${opts.to}: ${opts.subject}`);
  }
}
