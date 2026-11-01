#!/usr/bin/perl
# Aperçu local du site (sans Python ni Node) : perl tools/serve.pl [dossier] [port]
# Sert les fichiers statiques et accepte l'enregistrement des images générées
# par tools/og-image.html (POST /__save/<chemin autorisé>).
use strict;
use warnings;
use IO::Socket::INET;

my $root = $ARGV[0] // '.';
my $port = $ARGV[1] // 4321;
my %types = (
  html => 'text/html; charset=utf-8', css => 'text/css; charset=utf-8', js => 'text/javascript; charset=utf-8',
  json => 'application/json', svg => 'image/svg+xml', png => 'image/png', jpg => 'image/jpeg', webp => 'image/webp',
  ico => 'image/x-icon', txt => 'text/plain; charset=utf-8', xml => 'application/xml; charset=utf-8', woff2 => 'font/woff2',
);
my %writable = map { $_ => 1 } qw(assets/img/og-image.jpg assets/img/apple-touch-icon.png);

my $server = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Listen => 32, ReuseAddr => 1)
  or die "Port $port indisponible : $!\n";
$| = 1;
print "Aperçu : http://localhost:$port/\n";

while (my $c = $server->accept) {
  binmode $c;
  my $line = <$c>;
  next unless defined $line;
  my ($method, $path) = $line =~ m{^(\w+)\s+(\S+)};
  my %head;
  while (my $h = <$c>) {
    last if $h =~ /^\r?\n$/;
    $head{lc $1} = $2 if $h =~ /^([^:]+):\s*(.*?)\r?\n$/;
  }
  $path //= '/';
  $path =~ s/\?.*//;
  $path =~ s/%([0-9A-Fa-f]{2})/chr hex $1/ge;
  $path =~ s{^/+}{};

  if (($method // '') eq 'POST' && $path =~ m{^__save/(.+)$} && $writable{$1}) {
    my ($target, $len, $body) = ($1, $head{'content-length'} // 0, '');
    while (length($body) < $len) { read($c, $body, $len - length($body), length($body)) or last; }
    if (open my $out, '>:raw', "$root/$target") { print $out $body; close $out; reply($c, 204); print "Enregistré : $target\n"; }
    else { reply($c, 500, "text/plain", "Écriture impossible : $!"); }
    next;
  }

  $path .= 'index.html' if $path eq '' || $path =~ m{/$};
  my $file = "$root/$path";
  if ($path =~ /\.\./ || !-f $file) { reply($c, 404, 'text/plain; charset=utf-8', "Introuvable : /$path"); next; }
  my ($ext) = $path =~ /\.(\w+)$/;
  open my $in, '<:raw', $file or do { reply($c, 500, 'text/plain', 'Lecture impossible'); next };
  local $/;
  my $data = <$in>;
  close $in;
  reply($c, 200, $types{lc($ext // '')} // 'application/octet-stream', $data);
}

sub reply {
  my ($c, $code, $type, $body) = @_;
  my %status = (200 => 'OK', 204 => 'No Content', 404 => 'Not Found', 500 => 'Internal Server Error');
  $body //= '';
  print $c "HTTP/1.1 $code $status{$code}\r\n",
    ($type ? "Content-Type: $type\r\n" : ''),
    "Content-Length: ", length($body), "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n", $body;
  close $c;
}
