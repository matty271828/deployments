# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  for_each = local.frontend_repos

  account_id = var.cloudflare_account_id
  name       = each.value.repo_name
  production_branch = "main"
  
  build_config {
    build_command = "npm run build -- --mode production"
    destination_dir = "dist"
  }

  source {
    type = "github"
    config {
      owner = "matty271828"
      repo_name = each.value.repo_name
      production_branch = "main"
    }
  }
}