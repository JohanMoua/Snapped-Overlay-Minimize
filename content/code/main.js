const DEBUG = true;
const MIN_OVERLAP_WIDTH = 8;
const MIN_OVERLAP_HEIGHT = 8;

console.error("SnappedOverlapMinimize: loaded");

const scriptMinimizedIds = new Set();
let pending = false;

function log(msg) {
    if (DEBUG) {
        console.error("SnappedOverlapMinimize: " + msg);
    }
}

function safeConnect(obj, signalName, callback) {
    try {
        if (obj && obj[signalName] && obj[signalName].connect) {
            obj[signalName].connect(callback);
        }
    } catch (e) {
        log("Could not connect " + signalName + ": " + e);
    }
}

function idOf(w) {
    return String(w.internalId || w.windowId || w.caption || "");
}

function isRelevantWindow(w) {
    try {
        return w &&
            !w.deleted &&
            w.normalWindow &&
            w.minimizable &&
            !w.desktopWindow &&
            !w.dock &&
            !w.specialWindow &&
            !w.popupWindow &&
            !w.notification &&
            !w.onScreenDisplay;
    } catch (e) {
        return false;
    }
}

function rectFromGeometry(g) {
    const left = g.x !== undefined ? g.x : g.left;
    const top = g.y !== undefined ? g.y : g.top;

    let width = g.width;
    let height = g.height;

    if (width === undefined && g.right !== undefined && g.left !== undefined) {
        width = g.right - g.left;
    }

    if (height === undefined && g.bottom !== undefined && g.top !== undefined) {
        height = g.bottom - g.top;
    }

    return {
        left: left,
        top: top,
        right: left + width,
        bottom: top + height,
        width: width,
        height: height
    };
}

function frameRect(w) {
    return rectFromGeometry(w.frameGeometry || w.clientGeometry);
}

function intersectionSize(a, b) {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);

    return {
        width: Math.max(0, right - left),
        height: Math.max(0, bottom - top)
    };
}

function overlapsEnough(a, b) {
    const size = intersectionSize(frameRect(a), frameRect(b));
    return size.width >= MIN_OVERLAP_WIDTH && size.height >= MIN_OVERLAP_HEIGHT;
}

function sameDesktop(a, b) {
    if (a.onAllDesktops || b.onAllDesktops) {
        return true;
    }

    if (!a.desktops || !b.desktops || a.desktops.length === 0 || b.desktops.length === 0) {
        return true;
    }

    const ids = new Set(a.desktops.map(d => d.id));
    for (const d of b.desktops) {
        if (ids.has(d.id)) {
            return true;
        }
    }

    return false;
}

function sameActivity(a, b) {
    if (!a.activities || !b.activities || a.activities.length === 0 || b.activities.length === 0) {
        return true;
    }

    const ids = new Set(a.activities);
    for (const activity of b.activities) {
        if (ids.has(activity)) {
            return true;
        }
    }

    return false;
}

function coversMostOfOutput(w) {
    let outputGeometry = null;

    try {
        if (w.output && w.output.geometry) {
            outputGeometry = w.output.geometry;
        }
    } catch (e) {
    }

    if (!outputGeometry) {
        try {
            outputGeometry = workspace.clientArea(KWin.MaximizeArea, w);
        } catch (e) {
            return false;
        }
    }

    const wr = frameRect(w);
    const or = rectFromGeometry(outputGeometry);
    const size = intersectionSize(wr, or);
    const outputArea = Math.max(1, or.width * or.height);

    return (size.width * size.height) / outputArea >= 0.88;
}

function looksLikeSnappedToSide(w) {
    let areaGeometry = null;

    try {
        areaGeometry = workspace.clientArea(KWin.MaximizeArea, w);
    } catch (e) {
        return false;
    }

    const wr = frameRect(w);
    const ar = rectFromGeometry(areaGeometry);

    const heightRatio = wr.height / Math.max(1, ar.height);
    const widthRatio = wr.width / Math.max(1, ar.width);

    return heightRatio >= 0.80 && widthRatio >= 0.30;
}

function isDominantWindow(w) {
    if (!isRelevantWindow(w) || w.minimized) {
        return false;
    }

    try {
        if (w.fullScreen) {
            return true;
        }
    } catch (e) {
    }

    try {
        if (w.tile) {
            return true;
        }
    } catch (e) {
    }

    try {
        if (w.quickTileMode && w.quickTileMode !== 0) {
            return true;
        }
    } catch (e) {
    }

    try {
        if (w.maximizedHorizontally && w.maximizedVertically) {
            return true;
        }
    } catch (e) {
    }

    return coversMostOfOutput(w) || looksLikeSnappedToSide(w);
}

function shouldMinimize(lower, windows) {
    if (!isRelevantWindow(lower)) {
        return false;
    }

    const lowerIndex = windows.indexOf(lower);
    if (lowerIndex < 0) {
        return false;
    }

    for (let i = lowerIndex + 1; i < windows.length; i++) {
        const upper = windows[i];

        if (!isDominantWindow(upper)) {
            continue;
        }

        if (lower.output !== upper.output) {
            continue;
        }

        if (!sameDesktop(lower, upper) || !sameActivity(lower, upper)) {
            continue;
        }

        if (lower === upper || lower.transientFor === upper || upper.transientFor === lower) {
            continue;
        }

        if (!overlapsEnough(lower, upper)) {
            continue;
        }

        return true;
    }

    return false;
}

function sweep() {
    const windows = workspace.stackingOrder.filter(w => isRelevantWindow(w));

    const shouldBeMinimized = new Set();

    for (const w of windows) {
        if (shouldMinimize(w, windows)) {
            shouldBeMinimized.add(idOf(w));
        }
    }

    for (const w of windows) {
        const id = idOf(w);

        if (shouldBeMinimized.has(id)) {
            if (!w.minimized) {
                log("minimize: " + w.caption);
                scriptMinimizedIds.add(id);
                w.minimized = true;
            }
        } else {
            if (scriptMinimizedIds.has(id) && w.minimized) {
                log("restore: " + w.caption);
                scriptMinimizedIds.delete(id);
                w.minimized = false;
            } else if (!w.minimized) {
                scriptMinimizedIds.delete(id);
            }
        }
    }
}

function scheduleSweep() {
    if (pending) {
        return;
    }

    pending = true;

    callDBus("org.kde.KWin", "/KWin", "org.kde.KWin", "supportInformation", function () {
        pending = false;
        sweep();
    });
}

function connectWindow(w) {
    if (!isRelevantWindow(w)) {
        return;
    }

    safeConnect(w, "frameGeometryChanged", scheduleSweep);
    safeConnect(w, "clientGeometryChanged", scheduleSweep);
    safeConnect(w, "interactiveMoveResizeFinished", scheduleSweep);
    safeConnect(w, "tileChanged", scheduleSweep);
    safeConnect(w, "quickTileModeChanged", scheduleSweep);
    safeConnect(w, "maximizedChanged", scheduleSweep);
    safeConnect(w, "fullScreenChanged", scheduleSweep);
    safeConnect(w, "minimizedChanged", scheduleSweep);
    safeConnect(w, "outputChanged", scheduleSweep);
    safeConnect(w, "desktopsChanged", scheduleSweep);
    safeConnect(w, "stackingOrderChanged", scheduleSweep);
}

safeConnect(workspace, "windowAdded", function (w) {
    connectWindow(w);
    scheduleSweep();
});

safeConnect(workspace, "windowRemoved", scheduleSweep);
safeConnect(workspace, "windowActivated", scheduleSweep);
safeConnect(workspace, "currentDesktopChanged", scheduleSweep);
safeConnect(workspace, "stackingOrderChanged", scheduleSweep);

for (const w of workspace.stackingOrder) {
    connectWindow(w);
}

scheduleSweep();
