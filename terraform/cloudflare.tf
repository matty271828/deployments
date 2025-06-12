# Get existing zones for domains
data "cloudflare_zones" "domains" {
  filter {
    name = join("|", local.domains)
  }
}

locals {
  # Create a map of domain to zone_id for existing zones
  existing_zones = { for zone in data.cloudflare_zones.domains.zones : zone.name => zone.id }
  
  # Filter out domains that already have zones
  new_domains = [for domain in local.domains : domain if !contains(keys(local.existing_zones), domain)]
}

# Create zones only for new domains
resource "cloudflare_zone" "domains" {
  for_each = toset(local.new_domains)
  account_id = var.cloudflare_account_id
  zone       = each.value
}

# Combine existing and new zones
locals {
  all_zones = merge(
    { for domain, id in local.existing_zones : domain => { id = id, zone = domain } },
    { for domain, zone in cloudflare_zone.domains : domain => { id = zone.id, zone = domain } }
  )
}

# A Records for domains
resource "cloudflare_record" "root" {
  for_each = local.all_zones
  zone_id = each.value.id
  name    = "@"
  content = digitalocean_droplet.multi-project-server[0].ipv4_address
  type    = "A"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
  allow_overwrite = true  # Allow overwriting existing records
}

# CNAME Records for domains
resource "cloudflare_record" "www" {
  for_each = local.all_zones
  zone_id = each.value.id
  name    = "www"
  content = each.value.zone
  type    = "CNAME"
  proxied = true  # This enables Cloudflare's proxy (orange cloud)
  allow_overwrite = true  # Allow overwriting existing records
}