use reqwest::Client;

#[derive(Clone)]
pub struct EmailService {
    client: Client,
    api_key: String,
    from_email: String,
    base_url: String,
}

impl EmailService {
    pub fn new(api_key: String, from_email: String, base_url: String) -> Self {
        Self {
            client: Client::new(),
            api_key,
            from_email,
            base_url,
        }
    }

    /// Create a no-op email service when Resend is not configured.
    pub fn noop() -> Self {
        Self {
            client: Client::new(),
            api_key: String::new(),
            from_email: String::new(),
            base_url: String::new(),
        }
    }

    pub fn is_configured(&self) -> bool {
        !self.api_key.is_empty()
    }

    pub async fn send_verification_email(
        &self,
        to_email: &str,
        username: &str,
        token: &str,
    ) -> Result<(), String> {
        if !self.is_configured() {
            tracing::warn!(
                "Email service not configured, skipping verification email to {}",
                to_email
            );
            return Ok(());
        }

        let verify_url = format!("{}/api/auth/verify-email?token={}", self.base_url, token);

        let body = serde_json::json!({
            "from": self.from_email,
            "to": [to_email],
            "subject": "Gotion - Verify your email",
            "html": format!(
                "<h2>Welcome to Gotion, {}!</h2>\
                 <p>Click the link below to verify your email address:</p>\
                 <p><a href=\"{}\">Verify Email</a></p>\
                 <p>This link expires in 24 hours.</p>\
                 <p>If you didn't create this account, you can ignore this email.</p>",
                username, verify_url
            ),
        });

        let res = self
            .client
            .post("https://api.resend.com/emails")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to send email: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            return Err(format!("Resend API error {}: {}", status, text));
        }

        tracing::info!("Verification email sent to {}", to_email);
        Ok(())
    }

    pub async fn send_password_reset(
        &self,
        to_email: &str,
        reset_url: &str,
    ) -> Result<(), String> {
        if !self.is_configured() {
            tracing::warn!(
                "Email service not configured, skipping password reset email to {}",
                to_email
            );
            return Ok(());
        }

        let body = serde_json::json!({
            "from": self.from_email,
            "to": [to_email],
            "subject": "Gotion - Reset your password",
            "html": format!(
                "<h2>Password Reset</h2>\
                 <p>You requested a password reset for your Gotion account.</p>\
                 <p><a href=\"{}\">Reset your password</a></p>\
                 <p>This link expires in 15 minutes.</p>\
                 <p>If you didn't request this, you can safely ignore this email.</p>",
                reset_url
            ),
        });

        let res = self
            .client
            .post("https://api.resend.com/emails")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to send email: {}", e))?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            return Err(format!("Resend API error {}: {}", status, text));
        }

        tracing::info!("Password reset email sent to {}", to_email);
        Ok(())
    }
}
