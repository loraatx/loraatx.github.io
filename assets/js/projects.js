document.addEventListener('DOMContentLoaded', () => {
  fetch('assets/projects.json')
    .then(response => response.json())
    .then(projects => {
      const grid = document.getElementById('projects-grid');
      projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';

        const img = document.createElement('img');
        img.src = project.thumbnail || 'https://via.placeholder.com/300x200?text=No+Image';
        img.alt = project.title;
        card.appendChild(img);

        const title = document.createElement('h3');
        title.textContent = project.title;
        card.appendChild(title);

        const description = document.createElement('p');
        description.textContent = project.description;
        card.appendChild(description);

        const link = document.createElement('a');
        link.href = project.link;
        link.textContent = 'Learn More';
        card.appendChild(link);

        grid.appendChild(card);
      });
    })
    .catch(err => console.error('Failed to load projects:', err));
});
