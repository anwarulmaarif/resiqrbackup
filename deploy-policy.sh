#!/bin/sh
set -e

POLICY_JSON='{
  "ExtensionInstallForcelist": [
    "pedfaiennijocigknemmgemahbhgnldf;https://raw.githubusercontent.com/anwarulmaarif/resiqrbackup/main/update.xml"
  ]
}'

# --- 1. Chrome dari repo/deb/rpm (sistem-wide) ---
sudo mkdir -p /etc/opt/chrome/policies/managed
echo "$POLICY_JSON" | sudo tee /etc/opt/chrome/policies/managed/resiqrbackup.json > /dev/null
echo "Policy (deb/rpm) ditulis ke /etc/opt/chrome/policies/managed/resiqrbackup.json"

# --- 2. Chrome dari Flatpak (per-user, karena sandboxed) ---
FLATPAK_APP_ID="com.google.Chrome"

if command -v flatpak >/dev/null 2>&1 && flatpak list --app | grep -q "$FLATPAK_APP_ID"; then
    # Loop semua home user yang ada (asumsi /home/*)
    for userhome in /home/*; do
        [ -d "$userhome" ] || continue
        username=$(basename "$userhome")

        # Skip folder sistem seperti lost+found, atau nama yang bukan user valid
        [ "$username" = "lost+found" ] && continue
        id "$username" >/dev/null 2>&1 || continue

        target_dir="$userhome/.var/app/$FLATPAK_APP_ID/config/google-chrome/policies/managed"

        sudo -u "$username" mkdir -p "$target_dir" 2>/dev/null || sudo mkdir -p "$target_dir"

        echo "$POLICY_JSON" | sudo tee "$target_dir/resiqrbackup.json" > /dev/null

        sudo chown "$username:$username" "$target_dir/resiqrbackup.json"

        echo "Policy (flatpak) ditulis ke $target_dir/resiqrbackup.json"
    done
else
    echo "Flatpak Chrome ($FLATPAK_APP_ID) tidak terdeteksi terpasang, skip bagian flatpak."
fi

echo "Restart Chrome (pkill chrome / flatpak kill com.google.Chrome) agar policy terbaca."