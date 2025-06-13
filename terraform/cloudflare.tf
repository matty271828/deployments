locals {
  domains = jsondecode(file("${path.module}/../domains.json"))
  get_repo_name = { for domain in local.domains : domain.domain => split("/", domain.frontend_repo)[length(split("/", domain.frontend_repo)) - 1] }
}

# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  for_each = { for domain in local.domains : domain.domain => domain }

  account_id = var.cloudflare_account_id
  name       = local.get_repo_name[each.key]
  production_branch = "main"
  
  build_config {
    build_command = "npm run build -- --mode production"
    destination_dir = "dist"
  }

  source {
    type = "github"
    config {
      owner = "matty271828"
      repo_name = local.get_repo_name[each.key]
      production_branch = "main"
    }
  }
}