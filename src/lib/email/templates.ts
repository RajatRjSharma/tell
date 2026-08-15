function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(options: {
  preheader: string;
  title: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f2;color:#18201c;font-family:Georgia,'Times New Roman',serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f4f2;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:560px;background:#fafbf9;border:1px solid #dfe3df;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px;border-bottom:1px solid #dfe3df;">
              <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#1f6b4f;">Tell Research</div>
              <h1 style="margin:12px 0 0;font-size:26px;line-height:1.15;letter-spacing:-0.03em;">${escapeHtml(options.title)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px;font-size:15px;line-height:1.6;color:#5f6a64;">
              ${options.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;font-family:ui-monospace,Menlo,monospace;font-size:11px;line-height:1.5;color:#7d8781;border-top:1px solid #dfe3df;">
              Research aid only. Not financial advice.<br />
              You received this because of your Tell account settings.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function otpEmailTemplate(options: {
  code: string;
  expireMinutes: number;
}): { subject: string; html: string; text: string } {
  const subject = `Your Tell verification code: ${options.code}`;
  const html = layout({
    preheader: `Use ${options.code} to finish creating your Tell account.`,
    title: "Verify your email",
    bodyHtml: `
      <p style="margin:0 0 16px;">Enter this one-time code to complete registration. It expires in ${options.expireMinutes} minutes.</p>
      <div style="margin:20px 0;padding:18px;border-radius:12px;background:#dcebe3;text-align:center;font-family:ui-monospace,Menlo,monospace;font-size:28px;letter-spacing:0.28em;color:#18201c;font-weight:600;">
        ${escapeHtml(options.code)}
      </div>
      <p style="margin:0;">If you did not request this, you can ignore the email.</p>
    `,
  });
  const text = [
    "Verify your email — Tell Research",
    "",
    `Your code: ${options.code}`,
    `Expires in ${options.expireMinutes} minutes.`,
    "",
    "Research aid only. Not financial advice.",
  ].join("\n");
  return { subject, html, text };
}

export function alertEmailTemplate(options: {
  title: string;
  body: string;
  symbol: string;
  horizon: string;
  asOfDate: string;
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Tell alert · ${options.symbol} ${options.horizon}`;
  const appUrl = options.appUrl ?? "https://tell-gamma.vercel.app";
  const html = layout({
    preheader: options.body,
    title: options.title,
    bodyHtml: `
      <p style="margin:0 0 16px;">${escapeHtml(options.body)}</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:8px 0 20px;border-collapse:collapse;">
        <tr>
          <td style="padding:10px 0;border-top:1px solid #dfe3df;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#7d8781;">Symbol</td>
          <td style="padding:10px 0;border-top:1px solid #dfe3df;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#18201c;">${escapeHtml(options.symbol)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid #dfe3df;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#7d8781;">Horizon</td>
          <td style="padding:10px 0;border-top:1px solid #dfe3df;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#18201c;">${escapeHtml(options.horizon)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-top:1px solid #dfe3df;border-bottom:1px solid #dfe3df;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#7d8781;">As of</td>
          <td style="padding:10px 0;border-top:1px solid #dfe3df;border-bottom:1px solid #dfe3df;text-align:right;font-family:ui-monospace,Menlo,monospace;font-size:12px;color:#18201c;">${escapeHtml(options.asOfDate)}</td>
        </tr>
      </table>
      <p style="margin:0;">
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#18201c;color:#f3f4f2;text-decoration:none;font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;font-weight:600;">Open Tell outlook</a>
      </p>
    `,
  });
  const text = [
    options.title,
    "",
    options.body,
    "",
    `Symbol: ${options.symbol}`,
    `Horizon: ${options.horizon}`,
    `As of: ${options.asOfDate}`,
    "",
    `Open: ${appUrl}`,
    "",
    "Research aid only. Not financial advice.",
  ].join("\n");
  return { subject, html, text };
}

export function watchlistBriefEmailTemplate(options: {
  asOf: string | null;
  summary: string;
  bullets: string[];
  symbols: string[];
  appUrl?: string;
}): { subject: string; html: string; text: string } {
  const subject = `Tell watchlist brief · ${options.asOf ?? "latest"}`;
  const appUrl = options.appUrl ?? "https://tell-gamma.vercel.app";
  const bullets = options.bullets
    .slice(0, 6)
    .map((item) => `<li style="margin:0 0 8px;">${escapeHtml(item)}</li>`)
    .join("");
  const html = layout({
    preheader: options.summary.slice(0, 120),
    title: "Your watchlist brief",
    bodyHtml: `
      <p style="margin:0 0 12px;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#7d8781;">
        ${escapeHtml(options.symbols.join(" · "))}
      </p>
      <p style="margin:0 0 16px;">${escapeHtml(options.summary)}</p>
      <ul style="margin:0 0 20px;padding-left:18px;">${bullets}</ul>
      <p style="margin:0;">
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#18201c;color:#f3f4f2;text-decoration:none;font-family:ui-sans-serif,system-ui,sans-serif;font-size:13px;font-weight:600;">Review on Tell</a>
      </p>
    `,
  });
  const text = [
    "Your watchlist brief — Tell Research",
    options.symbols.join(", "),
    "",
    options.summary,
    ...options.bullets.map((item) => `• ${item}`),
    "",
    `Open: ${appUrl}`,
  ].join("\n");
  return { subject, html, text };
}
