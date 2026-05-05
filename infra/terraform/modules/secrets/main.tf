variable "name" {
  type = string
}

variable "secrets" {
  description = "Map of secret_name => placeholder_description (values populated out-of-band)"
  type        = map(string)
  default = {
    "jwt/private-key"  = "RS256 private key (PEM) — rotated quarterly"
    "jwt/public-key"   = "RS256 public key (PEM)"
    "iett/api-key"     = "İETT API key — rotated quarterly"
    "ego/api-key"      = "EGO API key — rotated quarterly"
    "iletimerkezi/key" = "İletimerkezi SMS gateway key"
    "sentry/dsn"       = "Sentry DSN (server)"
  }
}

variable "tags" {
  type    = map(string)
  default = {}
}

resource "aws_secretsmanager_secret" "this" {
  for_each    = var.secrets
  name        = "${var.name}/${each.key}"
  description = each.value
  tags        = var.tags
}

# We deliberately do NOT create initial values — operators populate them
# manually after `terraform apply` to keep secrets out of state files.

output "secret_arns" {
  value = { for k, v in aws_secretsmanager_secret.this : k => v.arn }
}
