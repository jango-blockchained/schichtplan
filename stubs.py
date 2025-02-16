from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import cv2
import pytesseract
from PIL import Image

# OpenCV stubs
def imread(filename: str) -> Optional[np.ndarray]: ...
def cvtColor(img: np.ndarray, code: int) -> np.ndarray: ...
def threshold(img: np.ndarray, thresh: int, maxval: int, type: int) -> Tuple[float, np.ndarray]: ...
def getStructuringElement(shape: int, ksize: Tuple[int, int]) -> np.ndarray: ...
def dilate(img: np.ndarray, kernel: np.ndarray, iterations: int = 1) -> np.ndarray: ...
def imwrite(filename: str, img: np.ndarray) -> bool: ...
def putText(
    img: np.ndarray,
    text: str,
    org: Tuple[int, int],
    fontFace: int,
    fontScale: float,
    color: Union[Tuple[int, int, int], int],
    thickness: int,
    lineType: int = ...,
) -> None: ...
def imencode(ext: str, img: np.ndarray) -> Tuple[bool, np.ndarray]: ...

# Constants
FONT_HERSHEY_SIMPLEX: int
COLOR_BGR2GRAY: int
THRESH_BINARY: int
THRESH_OTSU: int
MORPH_RECT: int
LINE_AA: int

# Tesseract stubs
def image_to_string(image: Image.Image, lang: Optional[str] = None, **kwargs: Any) -> str: ...

# PIL stubs
class Image:
    @staticmethod
    def open(fp: Union[str, bytes, Any]) -> 'Image': ... 