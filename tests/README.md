# Tests Cadence

Tests de bout en bout avec Playwright (iPhone 13 simulé). Servir le dossier de l'app sur le port 8765, puis lancer chaque fichier :

```
python3 -m http.server 8765 &
node tests/t_a.js        # séances : doublons, statistiques, reprise, glisser, barre d'onglets, notifications, recette
node tests/t_ui.js       # Séances, Statistiques, Par exercice, Coach, Menus, notifications
node tests/t_nut.js      # assiettes, fiche recette, Open Food Facts (simulé)
node tests/t_cam.js      # caméra : une seule demande, refus respecté (caméra simulée)
node tests/t_smoke.js    # non-régression de tous les onglets et réglages, export, suppression
node tests/t_sw.js       # service worker : anti-doublon des notifications push
node tests/t_worker.mjs  # Worker : un rappel n'est envoyé qu'une fois
```
Chaque test affiche PASS/FAIL et se termine par « TOUT PASSE » ou la liste des échecs.
