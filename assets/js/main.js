document.addEventListener('DOMContentLoaded', () => {
  fetch('assets/projects.json')
    .then(response => response.json())
    .then(projects => {
      const grid = document.getElementById('project-grid');
      if (!grid) return;
      projects.forEach(project => {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.innerHTML = `
          <img src="${project.image}" alt="${project.title}">
          <h3>${project.title}</h3>
          <p>${project.description}</p>
          <a href="${project.link}" target="_blank" rel="noopener">View project</a>
        `;
        grid.appendChild(card);
      });
    })
    .catch(err => console.error('Could not load projects', err));
});
