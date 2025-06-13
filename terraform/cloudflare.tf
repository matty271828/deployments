# Cloudflare Zone for each domain
resource "cloudflare_zone" "domains" {
  for_each = local.domain_map
  
  zone = each.value.domain
  account_id = var.cloudflare_account_id
}

# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  for_each = local.domain_map
  account_id = var.cloudflare_account_id
  name       = each.value.frontend_repo
  production_branch = "main"
  
  build_config {
    build_command = "npm run build -- --mode production"
    destination_dir = "dist"
  }

  source {
    type = "github"
    config {
      owner = "matty271828"  # Your GitHub username/organization
      repo_name = each.value.frontend_repo
      production_branch = "main"
    }
  }
}

# Create custom domains for Pages projects
resource "cloudflare_pages_domain" "custom_domain" {
  for_each = local.domain_map
  account_id = var.cloudflare_account_id
  project_name = each.value.frontend_repo
  domain = each.key

  depends_on = [cloudflare_pages_project.frontend]
}