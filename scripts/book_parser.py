import os
import sys
import csv
import random
from time import sleep  # delays between requests
import mysql.connector # mysql db
from typing import Optional
from dotenv import dotenv_values
config = dotenv_values("../.env")
from collections import defaultdict
from book_parser_helpers import save_image_to_filesystem, decode_unicode_escape, color_code, show_watchlist


def read_book_csv(filename: str, OFFSET: Optional[int], database_config: dict = None) -> None:
    """
    Goes through File and writes data to database.
    :param filename: The csv file to be read.
    *************
    :param OFFSET: Which row in the csv file to start from. Useful if you want to 
    parse some of the dataset now and resume later. Values < 0 will be treated as 0.
    *************
    :param database_config: A dictionary of database configuration options.
        - host (str): Database host.
        *************
        - user (str): Database username.
        *************
        - database (str): Database name.
        *************
        - password (str): Database password.
        *************
    :returns: Undefined
    """

    if not filename or not database_config:
        raise ValueError(color_code("Missing file name or database config options.\n", "error"))

    if not os.path.exists(filename):
        raise OSError(color_code(f"Cannot not find the file {filename}.\n", "error"))

    try:
        connection = mysql.connector.connect(**database_config)
        if connection.is_connected():
            print(color_code("Successfully connected to MySQL db. Beginning write operations...\n", "success"))
            cursor = connection.cursor()
    except mysql.connector.Error as error:
        raise error

    # Columns to be parsed in the csv
    DESIRED_COLUMNS = [
        "isbn13",
        "isbn10",
        "title",
        "authors",
        "thumbnail",
        "description",
        "average_rating",
        "published_year",
    ]

    if OFFSET and OFFSET < 0:
        OFFSET = 0

    rows_skipped = 0

    # Number of times operation has run
    iterations = 0

    # Max number of times to read from csv.
    MAX_ITERATIONS = 50
    
    # Time between writing from each row. Given so requests from save_image_to_filesystem don't occur so often.
    OPERATION_DELAY = 2

    # Minimum value to seed database inventory_quantity with.
    INVENTORY_QTY_SEED_MIN = 4
    
    # Maximum value to seed database inventory_quantity with.
    INVENTORY_QTY_SEED_MAX = 12

    null_images = {}  # stores books with null images as isbn-title pairs.
    bad_descriptions = {}  # stores books with faulty descriptions as isbn-title pairs.

    with open(filename, "r", encoding="utf-8") as f:
        csv_reader = csv.DictReader(f)

        for row in csv_reader:
            filtered_data = defaultdict(str)

            # skip over OFFSET rows.
            if OFFSET and rows_skipped <= OFFSET:
                rows_skipped += 1
                continue
            
            if iterations >= MAX_ITERATIONS:
                break

            # Only want certain columns
            for column in DESIRED_COLUMNS:
                print(color_code(f"Beginning write operations for {row['title']}...", "info"))

                if column == "authors":
                    authors = row[column].split(
                        ";"
                    )  # authors are separated by semicolons - only want primary author.
                    filtered_data[column] = (
                        authors[0].strip() if authors else "Unknown Author."
                    )

                # retrieve thumbnail for image based on supplied link (thumbnail field.)
                elif column == "thumbnail":
                    try:
                        filtered_data[column] = save_image_to_filesystem(
                            row[column],
                            row["title"],
                            os.path.join(os.path.expanduser("~"),"Projects","node_practice","library-project","public","bookCovers"),
                            os.path.join(os.path.expanduser("~"),"Projects","node_practice","library-project","public","bookCovers","notAvailable(1)"),
                            relative_path=True,
                            resize_original=True,
                        )
                    # function raises a value error if the image could not be retrieved.
                    except ValueError:
                        print(
                            color_code(f"No fallback URL provided for book {row['title']} and could not retrieve image. The image URL for this book will be set to None/null.\n", "warning")
                        )

                        null_images[row["isbn13"]] = row["title"]  # watchlist for any books with a null image.
                        filtered_data[column] = None

                # decode description
                elif column == "description":
                    # when looking through descriptions, attempt to decode any potential unicode values. If we cannot, use the text as-is, and place the book in a watchlist.
                    try:
                        filtered_data[column] = decode_unicode_escape(row[column])
                    except UnicodeDecodeError:
                        print(
                            color_code(f"Could not properly decode text for {row['title']}. Using supplied text.\n", "warning")
                        )
                        filtered_data[column] = row[column]
                        bad_descriptions[row["isbn13"]] = row["title"]

                # every other column should have expected data in a safe manner.
                else:
                    filtered_data[column] = row[column]
                # end of row

            # end of row loop
            filtered_data["quantity"] = random.randint(INVENTORY_QTY_SEED_MIN, INVENTORY_QTY_SEED_MAX)
            
            query = f"INSERT INTO books (isbn13, isbn10, title, author, image_url, description, rating, published_year, inventory_quantity) VALUES(%s, %s, %s, %s, %s, %s, %s, %s, %s)"

            # create a list that only contains the values of the filtered data.
            values = [value for value in list(filtered_data.values())]

            # add try catch here? Could also add some kind of safe-mode param that commits changes after each execution.
            cursor.execute(query, values)

            iterations += 1
            print(color_code("Pausing...\n", "info"))
            sleep(OPERATION_DELAY)

    print(color_code(f"Completed {iterations} operations. This is your offset value for future use, if necessary.\n", "success",))
    
    if OFFSET:
        print(color_code(f"Skipped over {rows_skipped} rows. {rows_skipped + iterations} is your offset value for future use, if necessary.\n", "info"))

    if null_images:  # if there are any null images, show them.
        print(
            color_code(f"Couldn't get images for {len(null_images)} books. These books have a None/null value in database.\n", "warning")
        )
        show_watchlist(null_images, "null_images")

    if bad_descriptions:  # if there are any faulty descriptions, show them.
        print(
            color_code(f"Couldn't decode {len(bad_descriptions)} books' descriptions. Used the supplied text.\n", "warning")
        )
        show_watchlist(bad_descriptions, "bad_descriptions")

    # maybe try catch block here
    print(color_code("Committing changes to database...\n", "info"))
    connection.commit()
    
    print(color_code("Done. Closing connections.\n", "success"))
    cursor.close()
    connection.close()

    return


if __name__ == "__main__":
    read_book_csv("../books.csv/books.csv")