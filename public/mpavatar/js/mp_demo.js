var mpwebgl;

jQuery(document).ready(function () {
    mpwebgl = $('#mpcanvas').mpwebgl({
        size: [],
        showfps: false,
        lookat: true
    });
    initLookAt();

    $(document).on("mpLoadComplete", function () {
        $("#mpcanvas").show();
        mpwebgl.instance.loadnextface("items/face/trent.bin");
        // Notify parent frame that avatar is ready
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'avatar-ready' }, '*');
        }
    });
});

function initLookAt() {
    if (!Module['canvas'])
        return;
    var c = Module['canvas'];
    $(c).on('mousemove', function (e) {
        if (!mpwebgl)
            return;
        var size = Module['canvas'].width;
        var x = e.offsetX / size;
        var y = 1.0 - e.offsetY / size;
        mpwebgl.instance.lookat(x, y);
    });
    $(c).on('mouseout', function (e) {
        if (!mpwebgl)
            return;
        mpwebgl.instance.resetlookat();
    });
}

// PostMessage API for parent frame control
window.addEventListener('message', function(e) {
    if (!mpwebgl || !mpwebgl.instance) return;
    var data = e.data;
    if (data.type === 'expression') {
        mpwebgl.instance.loadexpression(data.index || 0, 100, 1.0, 1.0);
    }
    if (data.type === 'voice') {
        mpwebgl.instance.loadvoice(data.path);
    }
});
