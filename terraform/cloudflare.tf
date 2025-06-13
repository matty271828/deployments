# Cloudflare Zone for each domain
resource "cloudflare_zone" "domains" {
  for_each = local.domain_map
  
  zone = each.value.domain
  account_id = var.cloudflare_account_id
}

# Output the zone IDs for reference
output "zone_ids" {
  value = { for domain, zone in cloudflare_zone.domains : domain => zone.id }
  description = "Map of domain names to their Cloudflare zone IDs"
}

# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  for_each = local.domain_map
  account_id = var.cloudflare_account_id
  name       = "${each.value.domain}"
  production_branch = "main"
  
  build_config {
    build_command = "npm run build -- --mode production"
    destination_dir = "dist"
  }

  source {
    type = "github"
    config {
      owner = each.value.domain
      repo_name = each.value.frontend_repo
      production_branch = "main"
    }
  }
}

# Create custom domains for Pages projects
resource "cloudflare_pages_domain" "custom_domain" {
  for_each = local.domain_map
  account_id = var.cloudflare_account_id
  project_name = "${each.value.domain}"
  domain = each.key

  depends_on = [cloudflare_pages_project.frontend]
}