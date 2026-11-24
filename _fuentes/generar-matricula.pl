#!/usr/bin/perl
# Genera las dos fichas de matrícula a partir de la plantilla.
# Uso (desde la carpeta archiff-formularios):  perl _fuentes/generar-matricula.pl
use strict; use warnings;

# ---- Ajustes que se pueden cambiar ----
my $SCRIPT_URL      = '';      # URL de la aplicación web de Apps Script (la pasa Vero)
my $SUBSCRIPTION_ID = 'null';  # ID del tipo de suscripción "Marketing Information" en HubSpot
my %VERSIONES = (
  'matricula/index.html'            => { precio => 3357, early => 'false', badge => '' },
  'matricula/early-bird/index.html' => { precio => 2857, early => 'true',  badge => '<span class="badge solid">Precio promocional</span>' },
);
# ---------------------------------------

sub leer { my $f = shift; open my $h, '<:raw', $f or die "No puedo leer $f: $!"; local $/; my $c = <$h>; close $h; return $c; }
my $plantilla = leer('_fuentes/matricula-plantilla.html');
my $logo = leer('_fuentes/logo-datauri.txt'); $logo =~ s/\s+$//;

for my $destino (sort keys %VERSIONES) {
  my $v = $VERSIONES{$destino};
  my $h = $plantilla;
  $h =~ s/__LOGO__/$logo/g;
  $h =~ s/__BADGE_EARLY__/$v->{badge}/g;
  $h =~ s/__PRECIO__/$v->{precio}/g;
  $h =~ s/__EARLY__/$v->{early}/g;
  $h =~ s/__SUBSCRIPTION__/$SUBSCRIPTION_ID/g;
  $h =~ s/__SCRIPT_URL__/$SCRIPT_URL/g;
  die "Quedan huecos sin rellenar en $destino\n" if $h =~ /__[A-Z_]+__/;
  open my $out, '>:raw', $destino or die "No puedo escribir $destino: $!"; print $out $h; close $out;
  print "Generado $destino\n";
}
