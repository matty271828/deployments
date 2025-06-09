resource "digitalocean_project" "multi_project" {
  name        = "multi-project"
  description = "Project for multi-project server"
  purpose     = "Web Application"
  environment = "Production"
}

resource "digitalocean_droplet" "multi-project server" {
  count = 1
  image  = "ubuntu-24-10-x64"
  name   = "multi-project-001"
  region = "lon1"
  size   = "s-1vcpu-1gb-35gb-intel"
  ssh_keys = [var.digitalocean_ssh_key_id]
  project_ids = [digitalocean_project.multi_project.id]
} 