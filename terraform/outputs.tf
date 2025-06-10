output "droplet_ip" {
  value = digitalocean_droplet.app[0].ipv4_address
}