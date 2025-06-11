# Cloudflare Zone
resource "cloudflare_zone" "domain" {
  account_id = var.cloudflare_account_id
  zone       = var.domain
}

# A Record for root domain
resource "cloudflare_record" "root" {
  zone_id = cloudflare_zone.domain.id
  name    = "@"
  content = digitalocean_droplet.multi-project-server[0].ipv4_address
  type    = "A"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
}

# CNAME Record for www subdomain
resource "cloudflare_record" "www" {
  zone_id = cloudflare_zone.domain.id
  name    = "www"
  content = var.domain
  type    = "CNAME"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
} 