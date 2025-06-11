# Cloudflare Zones
resource "cloudflare_zone" "domains" {
  for_each = toset(var.domains)
  account_id = var.cloudflare_account_id
  zone       = each.value
}

# A Records for root domains
resource "cloudflare_record" "root" {
  for_each = cloudflare_zone.domains
  zone_id = each.value.id
  name    = "@"
  content = digitalocean_droplet.multi-project-server[0].ipv4_address
  type    = "A"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
}

# CNAME Records for www subdomains
resource "cloudflare_record" "www" {
  for_each = cloudflare_zone.domains
  zone_id = each.value.id
  name    = "www"
  content = each.value.zone
  type    = "CNAME"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
} 