export type Book = {
  title: string;
  author?: string;
  yearRead: number;
  /** Amazon affiliate link used for click-through only. */
  amazonUrl?: string;
  /** Optional ISBN for Open Library cover lookup. */
  isbn13?: string;
  isbn10?: string;
  /** Optional manual cover image URL (takes priority over ISBN lookup). */
  coverSrc?: string;
  coverAlt?: string;
  /** Optional short note (e.g. why you liked it). */
  note?: string;
};

export type CurrentBook = Omit<Book, "yearRead">;

export const START_YEAR = 2026;

/**
 * Add books here.
 * - `yearRead` is the year you finished the book.
 * - Keep entries in any order; the page sorts/group them.
 */
export const books: Book[] = [
  {
    title: "Just Enough Research",
    author: "Erika Hall",
    yearRead: 2026,
    amazonUrl: "https://www.amazon.com/dp/1937557103?tag=melvinhogan-20",
    isbn13: "9781937557109",
    note: "A guide to doing just enough research to make informed decisions.",
  },
  {
    title: "The Design of Everyday Things  ",
    author: "Donald A. Norman",
    yearRead: 2026,
    amazonUrl: "https://www.amazon.com/dp/0465050654?tag=melvinhogan-20",
    isbn13: "9780465050657",
    isbn10: "0465050654",
    coverAlt: "Cover of The Design of Everyday Things",
    note: "A classic book on the design of everyday things.",
  },
  {
    title: "Conversational Design by Erika Hall",
    author: "Erika Hall",
    yearRead: 2026,
    amazonUrl: "https://www.amazon.com/dp/1937557103?tag=melvinhogan-20",
    isbn13: "978-1952616303",
    isbn10: "1952616303",
    coverAlt: "Cover of Conversational Design",
    note: "A guide to designing conversational interfaces.",
  },
  // Example:
  // {
  //   title: "The Example Book",
  //   author: "A. Author",
  //   yearRead: 2026,
  //   amazonUrl: "https://www.amazon.com/dp/XXXXXXXXXX?tag=YOURTAG-20",
  //   isbn13: "9780000000000",
  //   coverSrc: "/assets/images/example-book-cover.jpg",
  //   note: "Short note if you want one.",
  // },
];

/**
 * Books you are currently reading (rendered at the top of /books).
 */
export const currentlyReading: CurrentBook[] = [
  {
    title: "The Path Between the Seas: The Creation of the Panama Canal, 1870-1914",
    author: "David McCullough", 
    yearRead: 2026,
    amazonUrl: "https://www.amazon.com/dp/0393352153?tag=melvinhogan-20",
    isbn13: "978-0671244095",
    isbn10: "0671244094",
    coverAlt: "Cover of The Path Between the Seas",
    note: "A history of the construction of the Panama Canal.",
  },
  {
    title: "The Illusion of Life",
    author: "Frank Thomas and Ollie Johnston",  
    yearRead: 2026,
    amazonUrl: "https://www.amazon.com/dp/0486229048?tag=melvinhogan-20",
    isbn13: "978-0786860708",
    isbn10: "0786860707",
    coverAlt: "Cover of The Illusion of Life",
    note: "A classic book on the history of animation.",
  },
  {
    title: "Drawn to Life Volume 1",
    author: "Walt Stanchfield",
    yearRead: 2026,
    amazonUrl: "https://www.amazon.com/dp/1501173219?tag=melvinhogan-20",
    isbn13: "978-1032104416",  
    isbn10: "1032104414",
    coverAlt: "Cover of Drawn to Life Volume 1",
    note: "A book on the art of drawing.",
  },
];

