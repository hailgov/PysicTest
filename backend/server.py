from flask import (

    Flask,

    request,

    jsonify,

    send_from_directory,

    send_file

)

from pathlib import Path

from datetime import datetime

import threading

import uuid

import json

import re

import shutil

import os

import time



# ============================================================

# PATHS

# ============================================================

BASE_DIR = Path(__file__).resolve().parent

PROJECT_DIR = BASE_DIR.parent

FRONTEND_DIR = PROJECT_DIR / "frontend"

MUSIC_DIR = BASE_DIR / "music"

CACHE_FILE = BASE_DIR / "cache.json"

MUSIC_DIR.mkdir(parents=True, exist_ok=True)



# ============================================================

# FLASK

# ============================================================

app = Flask(__name__)



# ============================================================

# CONFIG

# ============================================================

WORKER_TOKEN = os.environ.get("PYSIC_WORKER_TOKEN", "").strip()

if not WORKER_TOKEN:

    print("WARNING: WORKER_TOKEN is not configured.")



# How long Render waits for the PC worker to finish a search

SEARCH_TIMEOUT = 55



# ============================================================

# JOB STATE

# ============================================================

jobs = {}

jobs_lock = threading.Lock()



# ============================================================

# CACHE

# ============================================================

cache_lock = threading.Lock()



def load_cache():

    if not CACHE_FILE.exists():

        return []

    try:

        with open(CACHE_FILE, "r", encoding="utf-8") as f:

            return json.load(f)

    except Exception:

        return []



def save_cache(cache):

    temporary = CACHE_FILE.with_suffix(".tmp")

    with open(

        temporary,

        "w",

        encoding="utf-8"

    ) as f:

        json.dump(

            cache,

            f,

            indent=2,

            ensure_ascii=False

        )

    temporary.replace(CACHE_FILE)



def get_cached(video_id):

    with cache_lock:

        cache = load_cache()

        for item in cache:

            if item.get("video_id") == video_id:

                path = Path(item.get("path", ""))

                if path.exists():

                    return item

    return None



def add_cache_entry(

    video_id,

    title,

    channel,

    thumbnail,

    path

):

    with cache_lock:

        cache = load_cache()

        cache = [

            item

            for item in cache

            if item.get("video_id") != video_id

        ]

        entry = {

            "cache_id": str(uuid.uuid4()),

            "video_id": video_id,

            "title": title,

            "channel": channel,

            "thumbnail": thumbnail,

            "path": str(path),

            "created_at": datetime.now().isoformat()

        }

        cache.append(entry)

        save_cache(cache)

        return entry



# ============================================================

# HELPERS

# ============================================================

def safe_filename(value):

    value = str(value or "Unknown")

    value = re.sub(

        r'[<>:"/\\\\|?*\x00-\x1f]',

        "",

        value

    )

    value = value.strip()

    if not value:

        value = "Unknown"

    return value[:120]



def valid_youtube_url(url):

    if not url:

        return False

    url = url.lower()

    allowed = (

        "youtube.com/",

        "www.youtube.com/",

        "music.youtube.com/",

        "youtu.be/"

    )

    return any(host in url for host in allowed)



def find_downloaded_file(job_id):

    matches = list(

        MUSIC_DIR.glob(

            f".tmp_{job_id}.*"

        )

    )

    if matches:

        return matches[0]

    return None



def update_job(job_id, **values):

    with jobs_lock:

        if job_id in jobs:

            jobs[job_id].update(values)



def worker_authorized():

    if not WORKER_TOKEN:

        return False

    token = request.headers.get("X-Worker-Token")

    return token == WORKER_TOKEN



# ============================================================

# FRONTEND

# ============================================================

@app.get("/")

def index():

    return send_from_directory(

        FRONTEND_DIR,

        "index.html"

    )



@app.get("/<path:path>")

def frontend(path):

    return send_from_directory(

        FRONTEND_DIR,

        path

    )



# ============================================================

# SEARCH

#

# IMPORTANT:

# Render DOES NOT run yt-dlp here.

#

# It creates a search job and waits for the PC worker.

# ============================================================

@app.get("/api/search")

def search():

    query = (

        request.args.get("q", "")

        .strip()

    )

    if not query:

        return jsonify({

            "success": True,

            "results": []

        })

    if len(query) > 200:

        return jsonify({

            "success": False,

            "error": "Search query is too long."

        }), 400



    job_id = str(uuid.uuid4())

    with jobs_lock:

        jobs[job_id] = {

            "type": "search",

            "status": "queued",

            "progress": 0,

            "query": query,

            "results": None,

            "error": None,

            "created_at": time.time()

        }



    # Wait for the PC worker.

    deadline = time.time() + SEARCH_TIMEOUT

    while time.time() < deadline:

        with jobs_lock:

            job = jobs.get(job_id)

            if not job:

                break

            if job["status"] == "finished":

                results = job.get("results", [])

                jobs.pop(job_id, None)

                return jsonify({

                    "success": True,

                    "results": results

                })

            if job["status"] == "error":

                error = job.get(

                    "error",

                    "Worker search failed."

                )

                jobs.pop(job_id, None)

                return jsonify({

                    "success": False,

                    "error": error

                }), 500

        time.sleep(0.25)



    with jobs_lock:

        jobs.pop(job_id, None)

    return jsonify({

        "success": False,

        "error": (

            "The Pysic worker is offline or "

            "did not respond in time."

        )

    }), 503



# ============================================================

# DOWNLOAD START

# ============================================================

@app.post("/api/download")

def start_download():

    data = request.get_json(

        silent=True

    ) or {}

    song = data.get("song")

    keep = bool(

        data.get(

            "keep",

            False

        )

    )

    if not song:

        return jsonify({

            "success": False,

            "error": "Missing song."

        }), 400



    url = song.get("url")

    if not valid_youtube_url(url):

        return jsonify({

            "success": False,

            "error": "Invalid YouTube URL."

        }), 400



    video_id = song.get("id")

    # Check cache first.

    if keep and video_id:

        existing = get_cached(video_id)

        if existing:

            job_id = str(uuid.uuid4())

            with jobs_lock:

                jobs[job_id] = {

                    "type": "download",

                    "status": "finished",

                    "progress": 100,

                    "path": existing["path"],

                    "error": None,

                    "keep": True,

                    "cached": True

                }

            return jsonify({

                "success": True,

                "job_id": job_id

            })



    job_id = str(uuid.uuid4())

    with jobs_lock:

        jobs[job_id] = {

            "type": "download",

            "status": "queued",

            "progress": 0,

            "path": None,

            "error": None,

            "keep": keep,

            "song": song,

            "cached": False,

            "created_at": time.time()

        }



    return jsonify({

        "success": True,

        "job_id": job_id

    })



# ============================================================

# DOWNLOAD STATUS

# ============================================================

@app.get("/api/download/<job_id>")

def download_status(job_id):

    with jobs_lock:

        job = jobs.get(job_id)

    if not job:

        return jsonify({

            "success": False,

            "error": "Job not found."

        }), 404



    response = {

        "success": True,

        "status": job["status"],

        "progress": job.get(

            "progress",

            0

        ),

        "error": job.get("error")

    }



    if (

        job["status"] == "finished"

        and job.get("path")

    ):

        response["url"] = (

            f"/api/file/{job_id}"

        )



    return jsonify(response)



# ============================================================

# FILE SERVING

# ============================================================

@app.get("/api/file/<job_id>")

def serve_job_file(job_id):

    with jobs_lock:

        job = jobs.get(job_id)

    if not job:

        return jsonify({

            "error": "File not found."

        }), 404



    path = job.get("path")

    if not path:

        return jsonify({

            "error": "File is not ready."

        }), 404



    file_path = Path(path)

    if not file_path.exists():

        return jsonify({

            "error": "File no longer exists."

        }), 404



    return send_file(

        file_path,

        conditional=True,

        as_attachment=False

    )



# ============================================================

# CLEANUP TEMP DOWNLOAD

# ============================================================

@app.post("/api/download/<job_id>/cleanup")

def cleanup_download(job_id):

    with jobs_lock:

        job = jobs.get(job_id)

    if not job:

        return jsonify({

            "success": False

        }), 404



    if job.get("keep"):

        return jsonify({

            "success": True,

            "deleted": False

        })



    path = job.get("path")

    if path:

        try:

            file_path = Path(path)

            if file_path.exists():

                file_path.unlink()

        except Exception:

            pass



    with jobs_lock:

        jobs.pop(

            job_id,

            None

        )



    return jsonify({

        "success": True,

        "deleted": True

    })



# ============================================================

# CACHE API

# ============================================================

@app.get("/api/cache")

def list_cache():

    with cache_lock:

        cache = load_cache()



    valid = []

    for item in cache:

        path = Path(

            item.get(

                "path",

                ""

            )

        )

        if path.exists():

            clean = dict(item)

            clean.pop(

                "path",

                None

            )

            clean["file_url"] = (

                "/api/cache/file/"

                f"{item['cache_id']}"

            )

            valid.append(clean)



    return jsonify({

        "success": True,

        "songs": valid

    })



# ============================================================

# CACHED FILE

# ============================================================

@app.get("/api/cache/file/<cache_id>")

def serve_cached_file(cache_id):

    with cache_lock:

        cache = load_cache()



    for item in cache:

        if item.get("cache_id") != cache_id:

            continue



        path = Path(

            item.get(

                "path",

                ""

            )

        )



        if not path.exists():

            break



        return send_file(

            path,

            conditional=True,

            as_attachment=False

        )



    return jsonify({

        "error": "Cached song not found."

    }), 404



# ============================================================

# DELETE CACHED FILE

# ============================================================

@app.delete("/api/cache/<cache_id>")

def delete_cached_file(cache_id):

    with cache_lock:

        cache = load_cache()

        target = None

        for item in cache:

            if item.get("cache_id") == cache_id:

                target = item

                break



        if not target:

            return jsonify({

                "success": False,

                "error": "Cached song not found."

            }), 404



        path = Path(

            target.get(

                "path",

                ""

            )

        )



        try:

            if path.exists():

                path.unlink()

        except Exception:

            pass



        cache = [

            item

            for item in cache

            if item.get("cache_id") != cache_id

        ]



        save_cache(cache)



    return jsonify({

        "success": True

    })



# ============================================================

# CLEAR CACHE

# ============================================================

@app.delete("/api/cache")

def clear_cache():

    with cache_lock:

        cache = load_cache()



        for item in cache:

            path = Path(

                item.get(

                    "path",

                    ""

                )

            )

            try:

                if path.exists():

                    path.unlink()

            except Exception:

                pass



        save_cache([])



    return jsonify({

        "success": True

    })



# ============================================================

# ============================================================

# WORKER API

# ============================================================

# These endpoints are ONLY for your PC worker.

# ============================================================

# ============================================================



# ============================================================

# GET NEXT JOB

# ============================================================

@app.get("/api/worker/next")

def worker_next():

    if not worker_authorized():

        return jsonify({

            "success": False,

            "error": "Unauthorized."

        }), 401



    with jobs_lock:

        # Search jobs

        for job_id, job in jobs.items():

            if (

                job.get("type") == "search"

                and job.get("status") == "queued"

            ):

                job["status"] = "processing"

                return jsonify({

                    "success": True,

                    "job": {

                        "job_id": job_id,

                        "type": "search",

                        "query": job["query"]

                    }

                })



        # Download jobs

        for job_id, job in jobs.items():

            if (

                job.get("type") == "download"

                and job.get("status") == "queued"

            ):

                job["status"] = "processing"

                return jsonify({

                    "success": True,

                    "job": {

                        "job_id": job_id,

                        "type": "download",

                        "song": job["song"],

                        "keep": job["keep"]

                    }

                })



    return jsonify({

        "success": True,

        "job": None

    })



# ============================================================

# WORKER SEARCH RESULT

# ============================================================

@app.post("/api/worker/search-result")

def worker_search_result():

    if not worker_authorized():

        return jsonify({

            "success": False,

            "error": "Unauthorized."

        }), 401



    data = request.get_json(

        silent=True

    ) or {}



    job_id = data.get("job_id")

    results = data.get(

        "results",

        []

    )



    if not job_id:

        return jsonify({

            "success": False,

            "error": "Missing job_id."

        }), 400



    with jobs_lock:

        job = jobs.get(job_id)

        if not job:

            return jsonify({

                "success": False,

                "error": "Job not found."

            }), 404



        job["status"] = "finished"

        job["progress"] = 100

        job["results"] = results



    return jsonify({

        "success": True

    })



# ============================================================

# WORKER PROGRESS

# ============================================================

@app.post("/api/worker/progress")

def worker_progress():

    if not worker_authorized():

        return jsonify({

            "success": False,

            "error": "Unauthorized."

        }), 401



    data = request.get_json(

        silent=True

    ) or {}



    job_id = data.get("job_id")

    if not job_id:

        return jsonify({

            "success": False,

            "error": "Missing job_id."

        }), 400



    update_job(

        job_id,

        status=data.get(

            "status",

            "downloading"

        ),

        progress=float(

            data.get(

                "progress",

                0

            )

        )

    )



    return jsonify({

        "success": True

    })



# ============================================================

# WORKER DOWNLOAD COMPLETE

# ============================================================

@app.post("/api/worker/complete")

def worker_complete():

    if not worker_authorized():

        return jsonify({

            "success": False,

            "error": "Unauthorized."

        }), 401



    job_id = request.form.get(

        "job_id"

    )



    if not job_id:

        return jsonify({

            "success": False,

            "error": "Missing job_id."

        }), 400



    uploaded_file = request.files.get(

        "file"

    )



    if not uploaded_file:

        return jsonify({

            "success": False,

            "error": "Missing file."

        }), 400



    with jobs_lock:

        job = jobs.get(job_id)



    if not job:

        return jsonify({

            "success": False,

            "error": "Job not found."

        }), 404



    song = job.get(

        "song",

        {}

    )



    video_id = song.get(

        "id",

        "unknown"

    )



    title = song.get(

        "title",

        "Unknown"

    )



    extension = Path(

        uploaded_file.filename or ""

    ).suffix.lower()



    if extension not in {

        ".m4a",

        ".mp4",

        ".aac",

        ".wav",

        ".ogg",

        ".flac",

        ".mp3"

    }:

        extension = ".m4a"



    # Temporary file on Render

    temp_path = (

        MUSIC_DIR

        / f".tmp_{job_id}{extension}"

    )



    uploaded_file.save(

        str(temp_path)

    )



    keep = bool(

        job.get(

            "keep",

            False

        )

    )



    if keep:

        permanent_name = (

            f"{safe_filename(video_id)} - "

            f"{safe_filename(title)}"

            f"{extension}"

        )



        permanent_path = (

            MUSIC_DIR

            / permanent_name

        )



        counter = 1

        while permanent_path.exists():

            permanent_name = (

                f"{safe_filename(video_id)} - "

                f"{safe_filename(title)} "

                f"({counter})"

                f"{extension}"

            )

            permanent_path = (

                MUSIC_DIR

                / permanent_name

            )

            counter += 1



        shutil.move(

            str(temp_path),

            str(permanent_path)

        )



        entry = add_cache_entry(

            video_id,

            title,

            song.get(

                "channel",

                ""

            ),

            song.get(

                "thumbnail",

                ""

            ),

            permanent_path

        )



        update_job(

            job_id,

            status="finished",

            progress=100,

            path=str(permanent_path),

            cache_id=entry["cache_id"],

            cached=True

        )



    else:

        update_job(

            job_id,

            status="finished",

            progress=100,

            path=str(temp_path),

            cached=False

        )



    return jsonify({

        "success": True

    })



# ============================================================

# WORKER ERROR

# ============================================================

@app.post("/api/worker/error")

def worker_error():

    if not worker_authorized():

        return jsonify({

            "success": False,

            "error": "Unauthorized."

        }), 401



    data = request.get_json(

        silent=True

    ) or {}



    job_id = data.get(

        "job_id"

    )



    error = data.get(

        "error",

        "Unknown worker error."

    )



    if not job_id:

        return jsonify({

            "success": False,

            "error": "Missing job_id."

        }), 400



    update_job(

        job_id,

        status="error",

        progress=0,

        error=str(error)

    )



    return jsonify({

        "success": True

    })



# ============================================================

# HEALTH CHECK

# ============================================================

@app.get("/api/health")

def health():

    return jsonify({

        "success": True,

        "worker_configured": bool(

            WORKER_TOKEN

        )

    })



# ============================================================

# LOCAL DEVELOPMENT

# ============================================================

if __name__ == "__main__":

    print()

    print("========================================")

    print("             PYSIC MUSIC")

    print("========================================")

    print()

    print("Frontend:")

    print("http://127.0.0.1:8000")

    print()

    print("Press CTRL+C to stop.")

    print()

    app.run(

        host="0.0.0.0",

        port=int(

            os.environ.get(

                "PORT",

                8000

            )

        ),

        debug=False,

        threaded=True

    )