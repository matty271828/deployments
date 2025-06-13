# Create Cloudflare Pages projects
resource "cloudflare_pages_project" "frontend" {
  account_id = var.cloudflare_account_id
  name       = "leetrepeat"
  production_branch = "main"
  
  build_config {
    build_command = "npm run build -- --mode production"
    destination_dir = "dist"
  }

  source {
    type = "github"
    config {
      owner = "matty271828"  # Your GitHub username/organization
      repo_name = "leetrepeat"
      production_branch = "main"
    }
  }
}