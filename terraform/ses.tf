# AWS SES Configuration for Email Service
# This file configures SES for sending and receiving emails for each custom domain

# Create SES domain identities for each domain
resource "aws_ses_domain_identity" "domain" {
  for_each = local.frontend_repos

  domain = each.key
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
  content = aws_ses_domain_identity.domain[each.key].verification_token
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

# Create MX record for receiving emails
resource "cloudflare_dns_record" "ses_mx" {
  for_each = local.frontend_repos

  zone_id  = cloudflare_zone.domain[each.key].id
  name     = each.key
  content  = "inbound-smtp.${var.aws_region}.amazonaws.com"
  type     = "MX"
  priority = 10
  ttl      = 1
}

# Create SPF record for email authentication
resource "cloudflare_dns_record" "ses_spf" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = each.key
  content = "v=spf1 include:amazonses.com ~all"
  type    = "TXT"
  ttl     = 1
}

# Create DMARC record for email authentication
resource "cloudflare_dns_record" "ses_dmarc" {
  for_each = local.frontend_repos

  zone_id = cloudflare_zone.domain[each.key].id
  name    = "_dmarc.${each.key}"
  content = "v=DMARC1; p=quarantine; rua=mailto:dmarc@${each.key}"
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