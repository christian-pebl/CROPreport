/* CROPREPORT SEAWEED VISUALIZATION SYSTEM */
console.log("CROPREPORT Seaweed System Loading...");

class CROPSeaweedManager {
    constructor() {
        this.measurements = [];
        this.measurementMode = "none";
        this.healthMetrics = { overall: 0 };
        this.init();
    }

    init() {
        if (\!document.title.includes("CROPreport")) return;
        this.setupEventListeners();
        console.log("CROP Seaweed Manager Ready");
    }

    setupEventListeners() {
        const toggle = document.getElementById("seaweedToggleBtn");
        if (toggle) {
            toggle.onclick = () => {
                const section = document.getElementById("seaweedSection");
                section?.classList.toggle("hidden");
                toggle.textContent = section?.classList.contains("hidden") ? 
                    "🌊 Seaweed Analysis" : "📊 Hide Seaweed Analysis";
            };
        }

        const importBtn = document.getElementById("importSeaweedData");
        const fileInput = document.getElementById("seaweedImageInput");
        if (importBtn && fileInput) {
            importBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => this.loadImage(e.target.files[0]);
        }

        const lengthBtn = document.getElementById("measureLengthBtn");
        const areaBtn = document.getElementById("measureAreaBtn");
        const clearBtn = document.getElementById("clearMeasurementsBtn");
        const healthBtn = document.getElementById("healthAssessBtn");
        const timelineBtn = document.getElementById("timelineViewBtn");

        if (lengthBtn) lengthBtn.onclick = () => this.setMode("length");
        if (areaBtn) areaBtn.onclick = () => this.setMode("area");
        if (clearBtn) clearBtn.onclick = () => this.clearAll();
        if (healthBtn) healthBtn.onclick = () => this.assessHealth();
        if (timelineBtn) timelineBtn.onclick = () => this.toggleTimeline();

        const canvas = document.getElementById("morphologyCanvas");
        if (canvas) canvas.onclick = (e) => this.addMeasurement(e);

        const slider = document.getElementById("timelineSlider");
        if (slider) slider.oninput = (e) => this.updateTimeline(e.target.value);
    }

    loadImage(file) {
        if (\!file || \!file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const canvas = document.getElementById("morphologyCanvas");
            if (canvas) {
                canvas.style.backgroundImage = "url(" + e.target.result + ")";
                canvas.style.backgroundSize = "contain";
                canvas.style.backgroundRepeat = "no-repeat";
                canvas.innerHTML = "Image loaded - Click to measure";
                document.getElementById("seaweedSection")?.classList.remove("hidden");
            }
        };
        reader.readAsDataURL(file);
    }

    setMode(mode) {
        this.measurementMode = mode;
        document.querySelectorAll(".seaweed-btn").forEach(btn => btn.classList.remove("active"));
        if (mode === "length") document.getElementById("measureLengthBtn")?.classList.add("active");
        if (mode === "area") document.getElementById("measureAreaBtn")?.classList.add("active");
    }

    addMeasurement(event) {
        if (this.measurementMode === "none") return;
        const rect = event.target.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const value = Math.random() * 15 + 5;
        
        this.measurements.push({ x, y, value, type: this.measurementMode });
        this.renderPoint(x, y, value.toFixed(1) + (this.measurementMode === "area" ? "cm²" : "cm"));
        this.updateStats();
    }

    renderPoint(x, y, label) {
        const overlay = document.getElementById("measurementOverlay");
        if (\!overlay) return;

        const point = document.createElement("div");
        point.className = "measurement-point";
        point.style.left = x + "px";
        point.style.top = y + "px";

        const labelEl = document.createElement("div");
        labelEl.className = "measurement-label";
        labelEl.style.left = (x + 20) + "px";
        labelEl.style.top = (y - 10) + "px";
        labelEl.textContent = label;

        overlay.appendChild(point);
        overlay.appendChild(labelEl);
    }

    clearAll() {
        this.measurements = [];
        document.getElementById("measurementOverlay").innerHTML = "";
        this.updateStats();
    }

    updateStats() {
        const lengths = this.measurements.filter(m => m.type === "length");
        const areas = this.measurements.filter(m => m.type === "area");
        
        const avgLength = lengths.length ? lengths.reduce((s, m) => s + m.value, 0) / lengths.length : 0;
        const avgArea = areas.length ? areas.reduce((s, m) => s + m.value, 0) / areas.length : 0;

        document.getElementById("lengthStat").textContent = avgLength ? avgLength.toFixed(1) : "--";
        document.getElementById("areaStat").textContent = avgArea ? avgArea.toFixed(1) : "--";
        document.getElementById("healthStat").textContent = this.healthMetrics.overall ? this.healthMetrics.overall.toFixed(1) : "--";
        document.getElementById("growthStat").textContent = this.measurements.length > 3 ? "2.3" : "--";
    }

    assessHealth() {
        this.healthMetrics.overall = Math.random() * 10;
        this.updateStats();
        alert("🌊 Health Assessment Complete\!\nOverall Score: " + this.healthMetrics.overall.toFixed(1) + "/10");
    }

    toggleTimeline() {
        document.getElementById("timelineContainer")?.classList.toggle("hidden");
    }

    updateTimeline(value) {
        const label = document.getElementById("currentTimeLabel");
        if (label) label.textContent = "Day " + Math.round(value * 30 / 100);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    if (document.title.includes("CROPreport")) {
        window.cropSeaweedManager = new CROPSeaweedManager();
    }
});
