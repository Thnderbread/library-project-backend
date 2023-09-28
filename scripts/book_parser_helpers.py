import os
import sys
import json
import codecs # decoding text
import requests
from PIL import Image  # for image resizing, saving
from time import sleep  # delays between requests
from typing import Optional
from termcolor import colored # color coding response messages

# Handles saving the image to the filesystem based on the given url.
def save_image_to_filesystem(
    url: str,
    book_name: str,
    save_location: Optional[str] = None,
    fallback_url: Optional[str] = None,
    force_overwrite: bool = True,
    relative_path: bool = False,
    resize_original: bool = True,
    width: int = 190,
    height: int = 231,
) -> str:
    """
    Function takes in a URL and attempts to retrieve the image from it. It saves the image as a PNG.
    The function can also resize the image and save it to a specified location. 
    If said location is not supplied, saves image to current directory.
    Returns absolute path by default. If relative_path is set to true, will return the image's relative path.
    ****************************
    :param url: The URL of the image.
    ****************************
    :param book_name: The name of the book.
    ****************************
    :param save_location: The directory where the image should be saved.
    ****************************
    :param fallback_url: A URL for a fallback image in case of failure.
    ****************************
    :param force_overwrite: Whether to prompt for a new filename if an existing one is found for an image.
    Set to true by default - you will not be prompted.
    ****************************
    :param relative_path: Whether the relative path should be returned or not.
    If set to true, be mindful of path separators. For example, Windows separators are '\\'. These are 
    treated as escape characters in JavaScript, so you'd have trouble parsing the url string.
    ****************************
    :param resize_original: Whether to resize the original image.
    ****************************
    :param width: The width for resizing.
    ****************************
    :param height: The height for resizing.
    ****************************
    :return: The path to the original saved image. Resized image paths are printed to the console.
    """
    
    if not url:
        if fallback_url:
            print(
                color_code(f"\nURL for {book_name} not provided. Use fallback URL for not found image.\n", "warning")
            )
            return fallback_url
        else:
            raise ValueError(color_code("No valid image URL or fallback URL provided.\n", "error"))
        
    
    save_name = book_name.replace(" ", "_") # separating names here for semantics when printing / saving.
    
    REQUEST_DELAY = 1.5
    # Attempt to retrieve the image from the URL twice
    attempts = 0


    while attempts < 2:
        print(color_code(f"Attempting to retrieve image for {book_name}...\n", "info"))
        response = requests.get(url)

        if response.status_code == 200:
            image_path = os.path.join(
                save_location or os.getcwd(), f"{save_name}_cover_image.png"
            )
            
            if not force_overwrite:
                while os.path.exists(image_path):
                    new_image_name = input(color_code(f"There's already an image for the book: {book_name}. Supply a different filename or type 'overwrite' to overwrite. Any spaces will be replaced with underscores. ", "warning")).strip().lower()

                    if new_image_name == 'overwrite':
                        break
                
                new_image_name = new_image_name.replace(" ", "_")
                image_path = os.path.join(save_location or os.getcwd(), f"{new_image_name}")
            
            with open(image_path, "wb") as f:
                f.write(response.content)

            print(color_code("Successfully saved. Resizing image...\n", "success"))
            resized = Image.open(image_path)
            resized = resized.resize((width, height))

            if resize_original:
                print(color_code("Overwriting original image with resized...\n", "info"))
                resized.save(image_path)
                print(
                    color_code(f"Done. Overwrote image for {book_name} with resized image. Saved to path: {image_path}.\n", "success")
                )
            else:
                color_code(print("Saving resized image as a copy...\n"), "info")
                resized_image_name = f"resized_{new_image_name or save_name}.png"
                resized_path = os.path.join(save_location or os.getcwd(), resized_image_name)
                resized.save(resized_path)
                print(
                    color_code(f"Done. Saved new resized image for {book_name} to path: {resized_path}.\n", "success")
                )

            if relative_path:
                return os.path.relpath(image_path)
            return image_path

        else:
            print(
                color_code(f"Something went wrong while trying to get the image for {book_name}. Retrying...\n", "warning")
            )
            attempts += 1
            sleep(REQUEST_DELAY)

        if attempts == 2:
            print(
                color_code(f"Could not retrieve the image for {book_name}. Please use your fallback URL for not found image.\n", "warning")
            )
            return fallback_url

    raise ValueError(
        color_code(f"Could not get image for {book_name}. Fallback URL or valid image URL is required.\n", "error")
    )

# I just wanted some colorful stuff in my terminal lol
def color_code(text: str, code: str) -> str:
    """Color codes text and returns it. Note you will need to print 
    the value or call this function while raising an exception to see
    the values with color - uses the colored function from termcolor library.

    Args:
        :param text (str): Any text to color.
        *************
        :param code (str): The type of code to apply to the text.
        *************
        Any unsupported code will just return the given text.
        Case insensitive.
            - Error: Returns red text with 'ERROR' prepended.
            *************
            - Warning: Returns yellow text with 'WARNING' prepended.
            *************
            - Success: Returns green text with 'SUCCESS' prepended.
            *************
            - Info: Returns blue text with 'INFO' prepended.
            *************


    Returns:
        :return str: The colored text, prepended with the kind of code passed in.
    """
    match code.lower():
        case "error":
            return colored("ERROR: " + text, "red")
        case "warning":
            return colored("WARNING: " + text, "yellow")
        case "success":
            return colored("SUCCESS: " + text, "green")
        case "info":
            return colored("INFO: " + text, "blue")
        case _:
            return text

# for decoding unecode escaped values in descriptions.
def decode_unicode_escape(text: str) -> str:
    """Attempts to decode unicode escaped characters in text.

    Args:
        :param text (str): Any string value.

    Returns:
        :return The text, decoded or not. 
        If it could not decode the text, will return the original value.
    """
    try:
        return codecs.decode(text, "unicode_escape")
    except UnicodeDecodeError:
        print("Could not successfully decode text. Returning original value.")
        return text

# shows items in the watchlist to the terminal or to an outfile.
def show_watchlist(item: dict, item_name: Optional[str]) -> None:
    """Writes items from supplied dict to outfile or terminal.

    Args:
       :param item (dict): Expects values to be organized as ISBN: Title. Or, whatever you want, if it's not related to books.
       *************
       :param item_name (str): The name of item, the first argument. Used for printing contextual hints.
       Also used for naming the outfile if you choose to write to one, so make sure to pass an underscore if you would like.
       :returns: None.
    """
    while True:
        confirmation = input(
            color_code(f"Would you like to see which books fit the criteria of {item_name or 'items'}? Y/N: ", "info")
            ).strip().lower()
        if confirmation in ["yes", "y"]:
            
            while True:
                output_format = input(
                    color_code("Please select an output format. You will be prompted for file path in the next step if you choose file. (json | file): ", "info")
                    ).strip().lower()
                if output_format == "json":
                    print(json.dumps(item, indent=4))
                    return
                
                elif output_format == "file":
                    outfile = input(
                        color_code("Supply a file path. Existing file will be overwritten. Leave empty for a default file in current working directory. ", "info")
                        ).strip()
                    outfile = outfile or f"{item_name or 'items'}_watchlist.txt"
                    with open(outfile, "w") as file:
                        for key, value in item.items():
                            file.write(f"Isbn: {key} | Title: {value}\n")
                    print(color_code(f"Finished writing to file {outfile}.\n", "success"))
                    return
                elif output_format == "$$":
                    break
                else:
                    print(color_code("Invalid input. try again. Or, if you'd like to leave, enter '$$'.\n", "error"))
        elif confirmation in ["no, n"]:
            return
        print(color_code("Invalid input. Please enter yes to see watchlist or no to abandon.\n", "error"))

if __name__ == "__main__":
    print("Running a test for saving the cover image for Gilead to your downloads folder. Edit module directly to change options.")
    sleep(1)
    save_image_to_filesystem(
        url="http://books.google.com/books/content?id=KQZCPgAACAAJ&printsec=frontcover&img=1&zoom=1&source=gbs_api",
        book_name="Gilead",
        save_location=os.path.join(os.path.expanduser("~"), "Downloads"),
        fallback_url=os.path.join(os.path.expanduser("~"), "Downloads"),
        force_overwrite=False,
        relative_path=False,
        resize_original=False
    )