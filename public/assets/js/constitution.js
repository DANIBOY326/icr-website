document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("constitution-search");
  const articles = Array.from(document.querySelectorAll(".constitution-article"));
  const tocLinks = Array.from(document.querySelectorAll(".toc-list a"));

  searchInput?.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    articles.forEach((article) => {
      const match = !q || article.textContent.toLowerCase().includes(q);
      article.style.display = match ? "" : "none";
    });
  });

  document.getElementById("print-constitution")?.addEventListener("click", () => window.print());

  if ("IntersectionObserver" in window && articles.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            tocLinks.forEach((link) => {
              link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
            });
          }
        });
      },
      { rootMargin: "-25% 0px -65% 0px" }
    );
    articles.forEach((a) => observer.observe(a));
  }
});
