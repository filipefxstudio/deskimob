export const DEFAULT_FROM = "Deskimob <onboarding@resend.dev>";

export type SendEmailResult = {
  success: boolean;
  error?: string;
  resendBody?: unknown;
};

function getResendErrorMessage(status: number, resendBody: unknown): string {
  const message =
    typeof resendBody === "object" &&
    resendBody !== null &&
    "message" in resendBody &&
    typeof (resendBody as { message: unknown }).message === "string"
      ? (resendBody as { message: string }).message
      : `Resend API error (${status})`;

  if (
    status === 403 &&
    message.toLowerCase().includes("testing emails")
  ) {
    return `${message} Defina RESEND_FROM_EMAIL com um domínio verificado no Resend para enviar a outros destinatários.`;
  }

  return message;
}

export async function sendEmail(
  functionName: string,
  to: string,
  subject: string,
  html: string,
  options?: {
    apiKey?: string;
    from?: string;
  },
): Promise<SendEmailResult> {
  const apiKey = options?.apiKey?.trim() || process.env.RESEND_API_KEY;
  const from = options?.from?.trim() || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;

  const apiKeySet = Boolean(apiKey);

  console.info("[email]", {
    phase: "before",
    function: functionName,
    from,
    to,
    subject,
    apiKeySet,
  });

  if (!apiKeySet) {
    console.info("[email]", {
      phase: "after",
      function: functionName,
      from,
      to,
      subject,
      apiKeySet: false,
      result: "skipped",
      error: "RESEND_API_KEY not configured",
    });
    return { success: false, error: "RESEND_API_KEY not configured" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    let resendBody: unknown;
    try {
      resendBody = await response.json();
    } catch {
      resendBody = null;
    }

    if (!response.ok) {
      const errorMessage = getResendErrorMessage(response.status, resendBody);

      console.error("[email]", {
        phase: "after",
        function: functionName,
        from,
        to,
        subject,
        apiKeySet,
        result: "error",
        status: response.status,
        error: errorMessage,
        resendBody,
      });

      return { success: false, error: errorMessage, resendBody };
    }

    console.info("[email]", {
      phase: "after",
      function: functionName,
      from,
      to,
      subject,
      apiKeySet,
      result: "success",
      resendBody,
    });

    return { success: true, resendBody };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("[email]", {
      phase: "after",
      function: functionName,
      from,
      to,
      subject,
      apiKeySet,
      result: "error",
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}
