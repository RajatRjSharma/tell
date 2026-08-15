import { afterEach, describe, expect, it, vi } from "vitest";

const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const mockedSendMail = vi.fn();
  return {
    sendMailMock: mockedSendMail,
    createTransportMock: vi.fn(() => ({ sendMail: mockedSendMail })),
  };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

import {
  getSmtpConfig,
  isEmailDeliveryAvailable,
  sendMail,
} from "@/lib/email/mailer";

function configureSmtp() {
  process.env.SMTP_HOST = "smtp.example.test";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "test@example.test";
  process.env.SMTP_PASSWORD = "not-a-real-password";
  process.env.SMTP_FROM = "Tell Test <test@example.test>";
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.TEST_MODE;
  delete process.env.APP_ENV;
  delete process.env.EMAIL_DELIVERY_ENABLED;
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  delete process.env.SMTP_FROM;
  delete process.env.SMTP_USE_TLS;
});

describe("sendMail", () => {
  it("never creates an SMTP transport in test mode", async () => {
    process.env.TEST_MODE = "1";
    configureSmtp();

    const result = await sendMail({
      to: "recipient@example.test",
      subject: "Test",
      html: "<p>Test</p>",
      text: "Test",
    });

    expect(result).toEqual({
      sent: false,
      skipped: "Email disabled in test mode",
    });
    expect(createTransportMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("skips send when EMAIL_DELIVERY_ENABLED is off", async () => {
    process.env.EMAIL_DELIVERY_ENABLED = "false";
    configureSmtp();

    expect(isEmailDeliveryAvailable()).toBe(false);
    await expect(
      sendMail({
        to: "recipient@example.test",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      }),
    ).resolves.toEqual({
      sent: false,
      skipped: "Email delivery disabled",
    });
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("rejects header injection before creating a transport", async () => {
    configureSmtp();

    await expect(
      sendMail({
        to: "recipient@example.test\r\nBcc: attacker@example.test",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      }),
    ).rejects.toThrow("Invalid email recipient");
    expect(createTransportMock).not.toHaveBeenCalled();
  });

  it("uses TLS, bounded timeouts, and automated-message headers", async () => {
    configureSmtp();
    sendMailMock.mockResolvedValueOnce({ messageId: "fixture" });

    await expect(
      sendMail({
        to: "recipient@example.test",
        subject: "Test",
        html: "<p>Test</p>",
        text: "Test",
      }),
    ).resolves.toEqual({ sent: true });

    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requireTLS: true,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
        tls: expect.objectContaining({
          minVersion: "TLSv1.2",
          rejectUnauthorized: true,
        }),
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: {
          "Auto-Submitted": "auto-generated",
          "X-Auto-Response-Suppress": "All",
        },
      }),
    );
  });

  it("forces TLS in production even when the env asks to disable it", () => {
    configureSmtp();
    process.env.APP_ENV = "production";
    process.env.SMTP_USE_TLS = "false";

    expect(getSmtpConfig()?.useTls).toBe(true);
  });
});
