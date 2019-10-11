from fedora
run dnf install -y texlive-scheme-medium
run dnf install -y 'tex(fullpage.sty)'
workdir /build
copy . .
run ./build.sh
run cp user_doc.pdf /mnt
