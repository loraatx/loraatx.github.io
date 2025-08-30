document.addEventListener('DOMContentLoaded', () => {
  fetch('assets/projects.json')
    .then(response => response.json())
    .then(projects => {
      const grid = document.getElementById('project-grid');
      if (!grid) return;

      projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';

        const img = document.createElement('img');
        img.src = project.image || project.thumbnail || 'https://via.placeholder.com/300x200?text=No+Image';
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
        link.textContent = 'View project';
        link.target = '_blank';
        link.rel = 'noopener';
        card.appendChild(link);

        grid.appendChild(card);
      });
    })
    .catch(err => console.error('Could not load projects', err));
});
