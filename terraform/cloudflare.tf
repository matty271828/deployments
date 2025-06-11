# Cloudflare Load Balancer - Shared across all domains
resource "cloudflare_load_balancer" "main" {
  zone_id        = cloudflare_zone.domains[var.domain].id  # Using the first domain as the primary zone
  name           = "main-lb"
  fallback_pool_id = cloudflare_load_balancer_pool.main.id
  default_pool_ids = [cloudflare_load_balancer_pool.main.id]
  proxied        = true
}

# Load Balancer Pool - Shared across all domains
resource "cloudflare_load_balancer_pool" "main" {
  account_id = var.cloudflare_account_id
  name       = "main-pool"
  origins {
    name    = "origin-1"
    address = digitalocean_droplet.multi-project-server[0].ipv4_address
    enabled = true
  }
  monitor = cloudflare_load_balancer_monitor.main.id
}

# Load Balancer Monitor - Shared across all domains
resource "cloudflare_load_balancer_monitor" "main" {
  account_id     = var.cloudflare_account_id
  description    = "main-monitor"
  type           = "http"
  interval       = 60
  timeout        = 5
  retries        = 3
  method         = "GET"
  path           = "/"
  expected_body  = ""
  expected_codes = "200"
}

# Cloudflare Zones - One for each domain
# Using for_each to create a zone for each domain without overwriting existing ones
resource "cloudflare_zone" "domains" {
  for_each = toset([var.domain])  # This will add new domains without affecting existing ones
  account_id = var.cloudflare_account_id
  zone       = each.value
}

# A Records for root domains - One for each domain
resource "cloudflare_record" "root" {
  for_each = cloudflare_zone.domains
  zone_id = each.value.id
  name    = "@"
  value   = digitalocean_droplet.multi-project-server[0].ipv4_address
  type    = "A"
  proxied = true
}

# CNAME Records for www subdomains - One for each domain
resource "cloudflare_record" "www" {
  for_each = cloudflare_zone.domains
  zone_id = each.value.id
  name    = "www"
  value   = each.value.zone
  type    = "CNAME"
  proxied = true
} 