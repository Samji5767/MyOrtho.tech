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
    try {
      // Dynamic import avoids hard dependency on nodemailer at build time
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = 'nodemailer';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nodemailer: any = await import(/* webpackIgnore: true */ mod as string).catch(() => null);
      if (!nodemailer) {
        this.logger.warn('[EmailService] nodemailer not installed — email suppressed');
        return;
      }
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT ?? '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transporter.sendMail({
        from: this.fromAddress,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
      });
      this.logger.log(`[EmailService] Email sent to ${opts.to}: ${opts.subject}`);
    } catch (err) {
      this.logger.error(`[EmailService] Failed to send email to ${opts.to}:`, err);
    }
  }
}
