use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,  // user_id
    pub admin: bool,  // is_admin
    pub exp: usize,   // expiration timestamp
    pub iat: usize,   // issued at timestamp
}

#[derive(Clone)]
pub struct JwtSecret(pub String);

pub fn create_token(secret: &JwtSecret, user_id: &str, is_admin: bool) -> Result<String, String> {
    let now = chrono::Utc::now().timestamp() as usize;
    let exp = now + 7 * 24 * 60 * 60; // 7 days

    let claims = Claims {
        sub: user_id.to_string(),
        admin: is_admin,
        exp,
        iat: now,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.0.as_bytes()),
    )
    .map_err(|e| format!("Failed to create token: {}", e))
}

pub fn verify_token(secret: &JwtSecret, token: &str) -> Result<Claims, String> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.0.as_bytes()),
        &Validation::default(),
    )
    .map(|data| data.claims)
    .map_err(|e| format!("Invalid token: {}", e))
}
