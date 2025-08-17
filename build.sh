mkdir -p "build"
build="build/${PWD##*/}.zip"
[ -f $build ] && rm "$build"
zip -r "$build" . -x "*.md" "*.sh" ".*" "*/.*" "build*"
