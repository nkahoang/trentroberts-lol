$(document).ready(function () {
    $(window).resize(respondCanvas);
    $(window).on("orientationchange", respondCanvas);
    respondCanvas();
});

function respondCanvas() {
    var canvas = Module['canvas'];
    if (!canvas) return;
    var w = $(window).width();
    var h = $(window).height();
    var size = Math.min(w, h);
    canvas.width = size;
    canvas.height = size;
}
