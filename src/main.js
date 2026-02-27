document.addEventListener('DOMContentLoaded', () => {
    const video = document.getElementById('webcam');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    // UI Elements
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const retryBtn = document.getElementById('retry-btn');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const objectList = document.getElementById('object-list');

    let model = null;
    let isDetecting = false;

    // Initialization
    async function init() {
        try {
            updateStatus('Loading Model', 'active');

            // Start camera and model loading concurrently
            const [modelResult] = await Promise.all([
                loadModel(),
                setupCamera()
            ]);

            model = modelResult;

            // Setup canvas mapping to video dimensions
            video.addEventListener('loadedmetadata', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            });

            // Adjust canvas on resize
            window.addEventListener('resize', () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
            });

            // Hide loading state once camera starts playing
            video.addEventListener('playing', () => {
                loadingState.classList.remove('active');
                loadingState.classList.add('hidden');

                updateStatus('Active', 'active');
                statusDot.classList.add('active');

                // Start detection loop
                isDetecting = true;
                detectObjects();
            });

        } catch (error) {
            showError(error.message);
        }
    }

    async function loadModel() {
        // Load the model using COCO-SSD via CDN object `cocoSsd`
        // We use full mobilenet_v2 for higher detection accuracy than lite
        return await cocoSsd.load({ base: "mobilenet_v2" });
    }

    async function setupCamera() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Browser API navigator.mediaDevices.getUserMedia not available');
        }

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: 'environment', // Use rear camera on mobile
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        video.srcObject = stream;

        return new Promise((resolve) => {
            video.onloadedmetadata = () => resolve(video);
        });
    }

    function showError(msg) {
        loadingState.classList.remove('active');
        loadingState.classList.add('hidden');

        errorState.classList.remove('hidden');
        errorState.classList.add('active');

        errorMessage.textContent = msg;
        updateStatus('Error', 'error');
        statusDot.classList.remove('active');
        statusDot.classList.add('error');
    }

    function updateStatus(text, type) {
        statusText.textContent = text;
        if (type === 'active') {
            statusText.style.color = 'var(--success-color)';
        } else if (type === 'error') {
            statusText.style.color = 'var(--error-color)';
        } else {
            statusText.style.color = 'var(--text-secondary)';
        }
    }

    async function detectObjects() {
        if (!isDetecting || !model) return;

        // Skip frame if video is not ready
        if (video.readyState !== 4) {
            requestAnimationFrame(detectObjects);
            return;
        }

        // Ensure high accuracy by raising the minScore to 0.6 and reducing max boxes to 15
        const predictions = await model.detect(video, 15, 0.6);

        // Draw predictions
        renderPredictions(predictions);

        // Update UI with all detected objects
        objectList.innerHTML = '';

        if (predictions.length > 0) {
            // Sort by confidence (highest first)
            predictions.sort((a, b) => b.score - a.score);

            // Create a list item for each uniquely detected object (or all of them)
            predictions.forEach(pred => {
                const confidence = Math.round(pred.score * 100);
                const li = document.createElement('li');
                li.innerHTML = `<span>${pred.class}</span> <span class="confidence">${confidence}%</span>`;
                objectList.appendChild(li);
            });
        } else {
            const li = document.createElement('li');
            li.className = 'empty-state';
            li.textContent = 'Scanning environment...';
            objectList.appendChild(li);
        }

        requestAnimationFrame(detectObjects);
    }

    function renderPredictions(predictions) {
        // Clear previous frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Calculate scaling if CSS resizes video differently from native resolution
        const displayWidth = video.clientWidth;
        const displayHeight = video.clientHeight;

        // Match the canvas visual size to the video visual size
        canvas.style.width = displayWidth + 'px';
        canvas.style.height = displayHeight + 'px';

        // We do drawing in native video coordinates
        // because canvas width/height are set to videoWidth/videoHeight

        predictions.forEach(prediction => {
            const [x, y, width, height] = prediction.bbox;

            // Draw bounding box
            ctx.strokeStyle = '#3b82f6'; // Match accent color
            ctx.lineWidth = 4;
            ctx.strokeRect(x, y, width, height);

            // Add gradient inside bounding box
            const gradient = ctx.createLinearGradient(x, y, x, y + height);
            gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
            gradient.addColorStop(1, 'rgba(59, 130, 246, 0.05)');
            ctx.fillStyle = gradient;
            ctx.fillRect(x, y, width, height);

            // Draw Label Background (BELOW the bounding box)
            ctx.fillStyle = '#3b82f6';
            const text = `${prediction.class} ${Math.round(prediction.score * 100)}%`;
            ctx.font = '600 18px Outfit, sans-serif';

            const textWidth = ctx.measureText(text).width;
            const textHeight = parseInt(ctx.font, 10); // base 10

            // Draw background for text, positioning it directly BELOW the box outline
            ctx.fillRect(x, y + height, textWidth + 12, textHeight + 8);

            // Draw label text inside that background
            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, x + 6, y + height + textHeight);
        });
    }

    // Event Listeners
    retryBtn.addEventListener('click', () => {
        errorState.classList.remove('active');
        errorState.classList.add('hidden');
        init();
    });

    // Start App
    init();
});
