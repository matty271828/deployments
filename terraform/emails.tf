# AWS SES Configuration for Email Service
# This file configures SES for sending and receiving emails for each custom domain

# Create SES domain identities for each domain
resource "aws_ses_domain_identity" "domain" {
  for_each = local.frontend_repos

  domain = each.key
}

# Create SES email identities for support@domain addresses
resource "aws_ses_email_identity" "support" {
  for_each = local.frontend_repos

  email = "support@${each.key}"
}

# Create SES domain DKIM for each domain
resource "aws_ses_domain_dkim" "domain" {
  for_each = local.frontend_repos

  domain = aws_ses_domain_identity.domain[each.key].domain
}

# Create SES domain mail from for each domain
resource "aws_ses_domain_mail_from" "domain" {
  for_each = local.frontend_repos

  domain           = aws_ses_domain_identity.domain[each.key].domain
  mail_from_domain = "mail.${each.key}"
}

# Create DNS records for SES verification and DKIM
resource "cloudflare_dns_record" "ses_verification" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "_amazonses.${each.key}"
  content = "\"${aws_ses_domain_identity.domain[each.key].verification_token}\""
  type    = "TXT"
  ttl     = 1
}

resource "cloudflare_dns_record" "ses_dkim" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[0]}._domainkey.${each.key}"
  content = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[0]}.dkim.amazonses.com"
  type    = "CNAME"
  ttl     = 1
}

resource "cloudflare_dns_record" "ses_dkim_2" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[1]}._domainkey.${each.key}"
  content = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[1]}.dkim.amazonses.com"
  type    = "CNAME"
  ttl     = 1
}

resource "cloudflare_dns_record" "ses_dkim_3" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[2]}._domainkey.${each.key}"
  content = "${aws_ses_domain_dkim.domain[each.key].dkim_tokens[2]}.dkim.amazonses.com"
  type    = "CNAME"
  ttl     = 1
}

# Create MX record for receiving emails (FIXED: use @ for root domain)
resource "cloudflare_dns_record" "ses_mx" {
  for_each = local.frontend_repos

  zone_id  = cloudflare_zone.domain[each.key].id
  name     = "@"  # Root domain
  content  = "inbound-smtp.${var.aws_region}.amazonaws.com"
  type     = "MX"
  priority = 10
  ttl      = 1
}

# Create SPF record for email authentication (FIXED: use @ for root domain)
resource "cloudflare_dns_record" "ses_spf" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "@"  # Root domain
  content = "\"v=spf1 include:amazonses.com ~all\""
  type    = "TXT"
  ttl     = 1
}

# Create SPF record for mail from domain
resource "cloudflare_dns_record" "ses_mail_from_spf" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "mail.${each.key}"
  content = "\"v=spf1 include:amazonses.com ~all\""
  type    = "TXT"
  ttl     = 1
}

# Create MX record for mail from domain
resource "cloudflare_dns_record" "ses_mail_from_mx" {
  for_each = local.frontend_repos

  zone_id  = cloudflare_zone.domain[each.key].id
  name     = "mail.${each.key}"
  content  = "feedback-smtp.${var.aws_region}.amazonses.com"
  type     = "MX"
  priority = 10
  ttl      = 1
}

# Create MX record for support subdomain
resource "cloudflare_dns_record" "ses_support_mx" {
  for_each = local.frontend_repos

  zone_id  = cloudflare_zone.domain[each.key].id
  name     = "support.${each.key}"
  content  = "feedback-smtp.${var.aws_region}.amazonses.com"
  type     = "MX"
  priority = 10
  ttl      = 1
}

# Create SPF record for support subdomain
resource "cloudflare_dns_record" "ses_support_spf" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "support.${each.key}"
  content = "\"v=spf1 include:amazonses.com ~all\""
  type    = "TXT"
  ttl     = 1
}

# Create DMARC record for email authentication
resource "cloudflare_dns_record" "ses_dmarc" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "_dmarc.${each.key}"
  content = "\"v=DMARC1; p=quarantine; rua=mailto:${var.gmail_address}\""
  type    = "TXT"
  ttl     = 1
}

# Output SES domain identities for use in other resources
output "ses_domain_identities" {
  description = "The SES domain identities for each domain"
  value = {
    for key, identity in aws_ses_domain_identity.domain : key => {
      domain = identity.domain
      arn    = identity.arn
    }
  }
  sensitive = true
}

# Create SES receipt rules for each domain to handle incoming emails
resource "aws_ses_receipt_rule_set" "main" {
  rule_set_name = "main-receipt-rule-set"
}

resource "aws_ses_active_receipt_rule_set" "main" {
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
}

# Create S3 bucket for storing emails
resource "aws_s3_bucket" "email_storage" {
  for_each = local.frontend_repos

  bucket = "email-storage-${split(".", each.key)[0]}"
  
  tags = {
    Domain = each.key
    Purpose = "email-storage"
  }
}

# Configure S3 bucket for email storage
resource "aws_s3_bucket_versioning" "email_storage" {
  for_each = local.frontend_repos

  bucket = aws_s3_bucket.email_storage[each.key].id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket policy to allow SES to write emails
resource "aws_s3_bucket_policy" "email_storage" {
  for_each = local.frontend_repos

  bucket = aws_s3_bucket.email_storage[each.key].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowSESPuts"
        Effect = "Allow"
        Principal = {
          Service = "ses.amazonaws.com"
        }
        Action = [
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.email_storage[each.key].arn}/*"
      }
    ]
  })
}

# Store support@domain emails in S3
resource "aws_ses_receipt_rule" "support" {
  for_each = local.frontend_repos

  name          = "store-support-${each.key}"
  rule_set_name = aws_ses_receipt_rule_set.main.rule_set_name
  recipients    = ["support@${each.key}"]
  enabled       = true
  scan_enabled  = true

  add_header_action {
    header_name  = "X-Received-By"
    header_value = "support@${each.key}"
    position     = 1
  }

  s3_action {
    bucket_name = aws_s3_bucket.email_storage[each.key].bucket
    position    = 2
  }

  depends_on = [
    aws_ses_active_receipt_rule_set.main,
    aws_ses_domain_identity.domain,
    aws_s3_bucket.email_storage
  ]
}

# Configure SES for sending emails
resource "aws_ses_configuration_set" "main" {
  name = "main-configuration-set"
}

# Output the SES credentials (using existing AWS credentials)
output "ses_user_credentials" {
  description = "SES credentials for sending emails (using existing AWS credentials)"
  value = {
    access_key_id = var.aws_access_key_id
    secret_access_key = var.aws_secret_access_key
  }
  sensitive = true
}

# Debug outputs to help troubleshoot
output "ses_domain_status" {
  description = "SES domain verification status"
  value = {
    for key, identity in aws_ses_domain_identity.domain : key => {
      domain = identity.domain
      verification_token = identity.verification_token
    }
  }
}

output "email_storage_buckets" {
  description = "S3 buckets created for email storage"
  value = {
    for key, bucket in aws_s3_bucket.email_storage : key => {
      name = bucket.bucket
      arn  = bucket.arn
    }
  }
  sensitive = true
} 