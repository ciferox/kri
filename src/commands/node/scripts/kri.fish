
function activate
    set -l bin_path "$argv[1]/bin"
    if not contains -- $bin_path $fish_user_paths
        set -U fish_user_paths $bin_path $fish_user_paths
        echo 1
    end
end

function removepaths
    if set -l index (contains -i $argv[1] $PATH)
        set -e -U fish_user_paths[$index]
    end
end

function deactivate
    set -l prefix "$argv[1]/"
    for val in $PATH
        set -l target (string match -e -r "^$prefix.+" $val)
        if test -n "$target"
            removepaths $target
            echo 1
        end
    end
end

function run
    set -l fn $argv[1]
    set -l path $argv[2]

    switch "$fn"
        case set
            activate $path
        case del
            deactivate $path
        case \*
            echo "kri: unknown flag or command \"$fn\"" >&2
            return 1
    end
end

run $argv
