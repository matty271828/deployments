# Cloudflare Zones
resource "cloudflare_zone" "domains" {
  for_each = toset(concat([var.domain], try(tolist(data.terraform_remote_state.existing.outputs.domains), [])))
  account_id = var.cloudflare_account_id
  zone       = each.value
}

# Get existing domains from state
data "terraform_remote_state" "existing" {
  backend = "local"
  config = {
    path = "${path.module}/terraform.tfstate"
  }
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

# Output the list of all domains for future reference
output "domains" {
  value = keys(cloudflare_zone.domains)
} 