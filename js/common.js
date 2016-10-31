function loadTeapot() {
    var _teapot = {
        data: {},
        transform: {
            translate: [0, 0, -40],
            rotate: {
                angle: 0,
                around: [0, 1, 0]
            },
            scale: [1, 1, 1]
        },
        attributes: {
            ambientColorUniform: [0.0, 0.0, 0.0],
            pointLightingLocationUniform: [0.0, 0.0, 0.0],
            pointLightingSpecularColorUniform: [0.0, 0.0, 0.0],
            pointLightingDiffuseColorUniform: [0.0, 0.0, 0.0],

            materialShininessUniform: 0.0
        },
        others: {
            shader: 0,
            texture: 'galvanizedTexture'
        }
    };

    var request = new XMLHttpRequest();
    request.open("GET", "objects/Teapot.json");
    request.onreadystatechange = function () {
        if (request.readyState == 4) {
            _teapot.data = JSON.parse(request.responseText);
            gl.addObject(_teapot);
        }
    }
    request.send();

    return _teapot;
}

var lastTime = 0;
function animate() {
    var timeNow = new Date().getTime();
    if (lastTime != 0) {
        var elapsed = timeNow - lastTime;
        teapotAngle += 0.03 * elapsed;
    }
    lastTime = timeNow;
}

