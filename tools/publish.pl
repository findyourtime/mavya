#!/usr/bin/perl
# Publie le site sur GitHub sans git : perl tools/publish.pl "message du commit"
# Envoie tout le dossier (sauf ce que liste .gitignore) en un seul commit sur la
# branche main de findyourtime/mavya, via l'API GitHub et GitHub CLI (« gh auth login »
# fait une fois). Ce commit déclenche .github/workflows/pages.yml, qui met le site en ligne.
use strict;
use warnings;
use utf8;
use Cwd qw(abs_path);
use Digest::SHA qw(sha1_hex);
use Encode qw(decode);
use File::Basename qw(dirname);
use File::Find;
use File::Temp qw(tempfile);
use JSON::PP;
use MIME::Base64 qw(encode_base64);

binmode STDOUT, ':encoding(UTF-8)';
binmode STDERR, ':encoding(UTF-8)';

my $repo   = 'findyourtime/mavya';
my $branch = 'main';
my $root   = abs_path(dirname(__FILE__) . '/..');
my $gh     = -x "$ENV{HOME}/.local/bin/gh" ? "$ENV{HOME}/.local/bin/gh" : 'gh';
my $msg    = @ARGV ? decode('UTF-8', $ARGV[0]) : 'Mise à jour du site';
my $json   = JSON::PP->new->utf8->canonical;
$ENV{GH_PROMPT_DISABLED} = $ENV{GH_NO_UPDATE_NOTIFIER} = 1;

# 1. fichiers locaux, hors .git et .gitignore (nom simple : partout ; avec « / » : depuis la racine)
my @ignore;
if (open my $fh, '<', "$root/.gitignore") {
  while (<$fh>) {
    s/\s+$//;
    next if $_ eq '' || /^#/;
    my $anchored = m{/.};
    s{^/|/$}{}g;
    (my $re = quotemeta) =~ s/\\\*/[^\/]*/g;
    push @ignore, $anchored ? qr{^$re(?:/|$)} : qr{(?:^|/)$re(?:/|$)};
  }
}
my %local;   # chemin => [contenu, empreinte git]
find({ no_chdir => 1, wanted => sub {
  return if $File::Find::name eq $root;
  my $rel = decode('UTF-8', substr($File::Find::name, length($root) + 1));
  if ($rel eq '.git' || grep { $rel =~ $_ } @ignore) { $File::Find::prune = 1; return; }
  return unless -f $_;
  open my $in, '<:raw', $_ or die "Lecture impossible : $rel ($!)\n";
  my $data = do { local $/; <$in> } // '';
  $local{$rel} = [$data, sha1_hex('blob ' . length($data) . "\0" . $data)];
}}, $root);

# 2. état de la branche sur GitHub
my $head   = api(GET => "repos/$repo/git/ref/heads/$branch")->{object}{sha};
my $base   = api(GET => "repos/$repo/git/commits/$head")->{tree}{sha};
my $listed = api(GET => "repos/$repo/git/trees/$base?recursive=1");
die "Arborescence distante tronquée : publication annulée.\n" if $listed->{truncated};
my %remote = map { $_->{path} => $_->{sha} } grep { $_->{type} eq 'blob' } @{ $listed->{tree} };
my %known  = map { $_ => 1 } values %remote;

# 3. contenus nouveaux ou modifiés, puis arborescence complète (les fichiers absents sont supprimés)
my (@tree, @changes);
for my $path (sort keys %local) {
  my ($data, $sha) = @{ $local{$path} };
  push @changes, (exists $remote{$path} ? '~ ' : '+ ') . $path if ($remote{$path} // '') ne $sha;
  unless ($known{$sha}++) {
    my $sent = api(POST => "repos/$repo/git/blobs", { content => encode_base64($data, ''), encoding => 'base64' })->{sha};
    die "Empreinte inattendue pour $path\n" unless $sent eq $sha;
  }
  push @tree, { path => $path, mode => '100644', type => 'blob', sha => $sha };
}
push @changes, map { "- $_" } grep { !exists $local{$_} } sort keys %remote;

my $tree = api(POST => "repos/$repo/git/trees", { tree => \@tree })->{sha};
if ($tree eq $base) { print "Rien à publier : GitHub a déjà cette version.\n"; exit; }

# 4. commit et avancée de la branche (refusée si quelqu'un a publié entre-temps)
my $commit = api(POST => "repos/$repo/git/commits", { message => $msg, tree => $tree, parents => [$head] })->{sha};
api(PATCH => "repos/$repo/git/refs/heads/$branch", { sha => $commit, force => JSON::PP::false() });
print "  $_\n" for @changes;
print "Publié sur $branch : https://github.com/$repo/commit/$commit\n";

sub api {
  my ($method, $path, $body) = @_;
  my @cmd = ($gh, 'api', '--method', $method, $path);
  if ($body) {
    my ($fh, $file) = tempfile(UNLINK => 1);
    binmode $fh;
    print $fh $json->encode($body);
    close $fh;
    push @cmd, '--input', $file, '--header', 'Content-Type: application/json';
  }
  open my $out, '-|', @cmd or die "GitHub CLI introuvable ($gh) : $!\n";
  my $res = do { local $/; <$out> };
  close $out;
  die "Échec de $method $path :\n" . decode('UTF-8', $res // '') . "\n" if $?;
  return $json->decode($res);
}
