"""Hero image generation using Google Imagen 4."""

import io
import logging
import os
import re
import shutil
import time
from pathlib import Path

from lib.costs import calc_imagen_cost, format_cost

logger = logging.getLogger("blog-engine.imagen")

ENGINE_ROOT = Path(__file__).resolve().parent.parent

MODEL = "imagen-4.0-generate-001"
IMAGE_WIDTH = 1200
IMAGE_HEIGHT = 630


def _get_client():
    """Get Google GenAI client."""
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set. Add it to .env file.")
    return genai.Client(api_key=api_key)


def _derive_imagery(title: str, description: str, imagery_map: dict) -> str:
    """Match title+description against imagery_map regex patterns."""
    text = f"{title} {description}"
    matches = []
    for pattern_str, imagery in imagery_map.items():
        if pattern_str == "default":
            continue
        try:
            if re.search(pattern_str, text, re.IGNORECASE):
                matches.append(imagery)
        except re.error:
            pass
    if matches:
        return ", ".join(matches[:3])
    return imagery_map.get("default", "professional documents, business planning, clean design")


def _derive_topic(title: str) -> str:
    """Extract short topic phrase from title."""
    topic = title
    topic = re.sub(r':\s*Complete.*$', '', topic, flags=re.IGNORECASE)
    topic = re.sub(r':\s*What.*$', '', topic, flags=re.IGNORECASE)
    topic = re.sub(r':\s*How.*$', '', topic, flags=re.IGNORECASE)
    topic = re.sub(r'\(\d{4}\)', '', topic)
    topic = re.sub(r'\s{2,}', ' ', topic).strip()
    return topic or title


def _build_prompt(title: str, description: str, hero_config: dict) -> str:
    """Build Imagen prompt from article metadata and config."""
    style = hero_config.get("style", "Professional illustration, clean minimalist design")
    color_scheme = hero_config.get("colorScheme", "navy blue, white, gold accents")
    imagery_map = hero_config.get("imageryMap", {})

    topic = _derive_topic(title)
    imagery = _derive_imagery(title, description, imagery_map)

    return (
        f"{style} for a blog article about {topic}. "
        f"Color palette: {color_scheme}. "
        f"Abstract geometric shapes or icons suggesting {imagery}. "
        f"No text, no words, no letters, no numbers, no watermarks. "
        f"Corporate, trustworthy aesthetic. Soft gradients and clean lines. "
        f"High resolution, suitable for web banner at 1200x630 pixels."
    )


async def generate_hero_images(
    title: str,
    description: str,
    hero_config: dict,
    output_dir: str | Path,
    count: int = 3,
) -> list[str]:
    """
    Generate hero image options using Imagen 4.
    Returns list of saved image file paths.
    """
    from google import genai
    from PIL import Image

    client = _get_client()
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    prompt = _build_prompt(title, description, hero_config)
    saved_paths = []

    t0 = time.time()
    images_generated = 0

    for i in range(count):
        try:
            response = client.models.generate_images(
                model=MODEL,
                prompt=prompt,
                config=genai.types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio="16:9",
                ),
            )

            if not response.generated_images:
                logger.warning("Image %d/%d: no images returned", i + 1, count)
                continue

            image_data = response.generated_images[0]

            # The Python SDK provides image_bytes as raw bytes
            if hasattr(image_data.image, 'image_bytes') and image_data.image.image_bytes:
                img_bytes = image_data.image.image_bytes
            else:
                logger.warning("Image %d/%d: no image_bytes in response", i + 1, count)
                continue

            # Open, resize, save as webp
            img = Image.open(io.BytesIO(img_bytes))
            img = img.resize((IMAGE_WIDTH, IMAGE_HEIGHT), Image.LANCZOS)

            path = output_dir / f"hero-option-{i + 1}.webp"
            img.save(str(path), "webp", quality=85)
            saved_paths.append(str(path))
            images_generated += 1

        except Exception as e:
            # Log but continue generating remaining images
            logger.warning("Error generating image %d/%d: %s", i + 1, count, e)
            continue

    latency = time.time() - t0

    call_info = calc_imagen_cost(MODEL, images_generated)
    call_info["call_name"] = "generate_hero_images"
    call_info["images_requested"] = count
    call_info["latency_s"] = round(latency, 2)
    logger.info("Hero images: %d/%d generated, %s", images_generated, count, format_cost(call_info))

    return (saved_paths, call_info)


def select_hero_image(selected_path: str | Path, output_dir: str | Path) -> str:
    """Copy selected option to hero.webp and clean up other options."""
    output_dir = Path(output_dir)
    final_path = output_dir / "hero.webp"
    shutil.copy2(str(selected_path), str(final_path))
    # Clean up option files
    for opt in output_dir.glob("hero-option-*.webp"):
        opt.unlink()
    return str(final_path)
